import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";
import { isDateWithinTrip, parseDateOnly, parseText, tripDateRangeError } from "@/lib/trips";
import { applyScheduleFields } from "@/lib/schedule";

const UPDATE_TYPES = ["GENERAL", "TRAVEL", "ITINERARY"] as const;
const UPDATE_KINDS = ["INFORMATIONAL", "SCHEDULE_CHANGE"] as const;
type TransactionClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

async function parseUpdateLink(tripId: number, body: Record<string, unknown>) {
  const updateType = UPDATE_TYPES.includes(body.updateType as typeof UPDATE_TYPES[number])
    ? body.updateType as typeof UPDATE_TYPES[number]
    : null;
  if (!updateType) return null;

  if (updateType === "TRAVEL") {
    const travelSegmentId = Number(body.travelSegmentId);
    if (!Number.isInteger(travelSegmentId)) return null;
    const segment = await prisma.travelSegment.findFirst({ where: { id: travelSegmentId, tripId }, select: { id: true } });
    return segment ? { updateType, travelSegmentId, sourceTravelSegmentId: travelSegmentId, itineraryItemId: null } : null;
  }
  if (updateType === "ITINERARY") {
    const itineraryItemId = Number(body.itineraryItemId);
    if (!Number.isInteger(itineraryItemId)) return null;
    const item = await prisma.itineraryItem.findFirst({ where: { id: itineraryItemId, tripId }, select: { id: true } });
    return item ? { updateType, travelSegmentId: null, sourceTravelSegmentId: null, itineraryItemId } : null;
  }
  return { updateType, travelSegmentId: null, sourceTravelSegmentId: null, itineraryItemId: null };
}

function parseSchedule(body: Record<string, unknown>, updateType: typeof UPDATE_TYPES[number], allowEmpty = false) {
  if (updateType === "GENERAL") return { updateKind: "INFORMATIONAL" as const, newDate: null, newTime: null, changesDate: false, changesTime: false };
  const requestedKind = UPDATE_KINDS.includes(body.updateKind as typeof UPDATE_KINDS[number])
    ? body.updateKind as typeof UPDATE_KINDS[number]
    : null;
  if (!requestedKind) return null;
  const updateKind = requestedKind;
  if (updateKind === "INFORMATIONAL") return { updateKind, newDate: null, newTime: null, changesDate: false, changesTime: false };

  const rawDate = typeof body.newDate === "string" ? body.newDate.trim() : "";
  const rawTime = typeof body.newTime === "string" ? body.newTime.trim() : "";
  const newDate = rawDate ? parseDateOnly(rawDate) : null;
  const newTime = rawTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : null;
  if ((rawDate && !newDate) || (rawTime && !newTime) || (!allowEmpty && !newDate && !newTime)) return null;
  return { updateKind, newDate, newTime, changesDate: Boolean(newDate), changesTime: Boolean(newTime) };
}

async function scheduleDateError(tripId: number, schedule: NonNullable<ReturnType<typeof parseSchedule>>) {
  if (!schedule.newDate) return null;
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { startDate: true, endDate: true },
  });
  if (!trip) return "Trip not found";
  return isDateWithinTrip(schedule.newDate, trip.startDate, trip.endDate)
    ? null
    : tripDateRangeError(trip.startDate, trip.endDate);
}

type UpdateLink = {
  updateType: typeof UPDATE_TYPES[number];
  travelSegmentId: number | null;
  sourceTravelSegmentId: number | null;
  itineraryItemId: number | null;
};

function scheduleTarget(link: UpdateLink) {
  return link.travelSegmentId
    ? { travelSegmentId: link.travelSegmentId }
    : link.itineraryItemId
      ? { itineraryItemId: link.itineraryItemId }
      : null;
}

async function lockScheduleTarget(tx: TransactionClient, tripId: number, link: UpdateLink) {
  if (link.travelSegmentId) {
    await tx.$queryRawUnsafe('SELECT "id" FROM "TravelSegment" WHERE "id" = $1 AND "tripId" = $2 FOR UPDATE', link.travelSegmentId, tripId);
  } else if (link.itineraryItemId) {
    await tx.$queryRawUnsafe('SELECT "id" FROM "ItineraryItem" WHERE "id" = $1 AND "tripId" = $2 FOR UPDATE', link.itineraryItemId, tripId);
  }
}

async function currentSchedule(tx: TransactionClient, tripId: number, link: UpdateLink) {
  if (link.travelSegmentId) {
    return tx.travelSegment.findFirst({ where: { id: link.travelSegmentId, tripId }, select: { date: true, time: true } });
  }
  if (link.itineraryItemId) {
    return tx.itineraryItem.findFirst({ where: { id: link.itineraryItemId, tripId }, select: { date: true, time: true } });
  }
  return { date: null, time: null };
}

async function applyFinalSchedule(
  tx: TransactionClient,
  tripId: number,
  link: UpdateLink,
  date: Date | null,
  time: string | null
) {
  if (link.travelSegmentId) {
    const segment = await tx.travelSegment.findFirst({ where: { id: link.travelSegmentId, tripId } });
    if (!segment) return null;
    await tx.travelSegment.update({ where: { id: segment.id }, data: { date, time } });
    const trip = date ? null : await tx.trip.findUnique({ where: { id: tripId }, select: { startDate: true, endDate: true } });
    const itineraryDate = date ?? (segment.returnForSegmentId ? trip?.endDate : trip?.startDate);
    await tx.itineraryItem.updateMany({
      where: { tripId, sourceTravelSegmentId: link.sourceTravelSegmentId },
      data: { ...(itineraryDate ? { date: itineraryDate } : {}), time: time ?? "00:00" },
    });
    return true;
  }

  if (link.itineraryItemId && date) {
    const item = await tx.itineraryItem.updateMany({
      where: { id: link.itineraryItemId, tripId },
      data: { date, time: time ?? "00:00" },
    });
    return item.count ? true : null;
  }
  return null;
}

async function reflowScheduleChanges(
  tx: TransactionClient,
  tripId: number,
  link: UpdateLink,
  base?: { date: Date | null; time: string | null }
) {
  const target = scheduleTarget(link);
  if (!target) return null;
  const updates = await tx.tripUpdate.findMany({
    where: { tripId, updateKind: "SCHEDULE_CHANGE", ...target },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const initial = base ?? (updates[0] ? { date: updates[0].originalDate, time: updates[0].originalTime } : await currentSchedule(tx, tripId, link));
  if (!initial) return null;
  let date = initial.date;
  let time = initial.time;

  for (const update of updates) {
    const next = applyScheduleFields(
      { date, time },
      { date: update.newDate, time: update.newTime, changesDate: update.changesDate, changesTime: update.changesTime }
    );
    await tx.tripUpdate.update({
      where: { id: update.id },
      data: { originalDate: date, originalTime: time, newDate: next.date, newTime: next.time },
    });
    date = next.date;
    time = next.time;
  }

  return applyFinalSchedule(tx, tripId, link, date, time);
}

async function ownedId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return null;
  const owned = await getOwnedTripId(id);
  return owned.session && owned.tripId ? owned.tripId : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = await ownedId(params);
  if (!tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const body = await request.json().catch(() => null);

  if (body?.action === "update") {
    const title = parseText(body.title, true);
    const content = parseText(body.content, true);
    const link = await parseUpdateLink(tripId, body);
    const schedule = link ? parseSchedule(body, link.updateType) : null;
    if (!title || !content || !link || !schedule) return NextResponse.json({ error: "Title, update details, and affected item are required" }, { status: 400 });
    const dateError = await scheduleDateError(tripId, schedule);
    if (dateError) return NextResponse.json({ error: dateError }, { status: dateError === "Trip not found" ? 404 : 400 });
    const update = await prisma.$transaction(async (tx: TransactionClient) => {
      if (schedule.updateKind !== "SCHEDULE_CHANGE") {
        return tx.tripUpdate.create({ data: { tripId, title, content, ...link, updateKind: schedule.updateKind } });
      }
      await lockScheduleTarget(tx, tripId, link);
      const original = await currentSchedule(tx, tripId, link);
      if (!original) return null;
      const created = await tx.tripUpdate.create({
        data: {
          tripId,
          title,
          content,
          ...link,
          updateKind: schedule.updateKind,
          originalDate: original.date,
          originalTime: original.time,
          newDate: schedule.newDate ?? original.date,
          newTime: schedule.newTime ?? original.time,
          changesDate: schedule.changesDate,
          changesTime: schedule.changesTime,
        },
      });
      return await reflowScheduleChanges(tx, tripId, link) ? created : null;
    });
    if (!update) return NextResponse.json({ error: "Affected item not found" }, { status: 404 });
    return NextResponse.json({ update }, { status: 201 });
  }

  if (body?.action === "poll") {
    const question = parseText(body.question, true);
    const rawChoices: unknown[] = Array.isArray(body.choices) ? body.choices : [];
    const choices = rawChoices.length
      ? [...new Set(rawChoices.map((choice) => parseText(choice, true)).filter((choice): choice is string => Boolean(choice)))]
      : [];
    if (!question || choices.length < 2 || choices.length > 10) {
      return NextResponse.json({ error: "Polls require a question and 2-10 choices" }, { status: 400 });
    }
    const poll = await prisma.poll.create({
      data: { tripId, question, options: { create: choices.map((label) => ({ label })) } },
      include: { options: true },
    });
    return NextResponse.json({ poll }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = await ownedId(params);
  if (!tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const body = await request.json().catch(() => null);

  if (body?.action === "update") {
    const updateId = Number(body.updateId);
    const title = parseText(body.title, true);
    const content = parseText(body.content, true);
    const link = await parseUpdateLink(tripId, body);
    const schedule = link ? parseSchedule(body, link.updateType, true) : null;
    if (!Number.isInteger(updateId) || !title || !content || !link || !schedule) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    const dateError = await scheduleDateError(tripId, schedule);
    if (dateError) return NextResponse.json({ error: dateError }, { status: dateError === "Trip not found" ? 404 : 400 });
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const existing = await tx.tripUpdate.findFirst({ where: { id: updateId, tripId } });
      if (!existing) return null;
      if (existing.updateType !== link.updateType
        || existing.travelSegmentId !== link.travelSegmentId || existing.itineraryItemId !== link.itineraryItemId) return false;
      if (existing.updateKind === "SCHEDULE_CHANGE" && schedule.updateKind !== "SCHEDULE_CHANGE") return false;
      if (schedule.updateKind !== "SCHEDULE_CHANGE") {
        await tx.tripUpdate.update({ where: { id: updateId }, data: { title, content, updateKind: schedule.updateKind } });
        return true;
      }
      await lockScheduleTarget(tx, tripId, link);
      await tx.tripUpdate.update({
        where: { id: updateId },
        data: {
          title,
          content,
          updateKind: schedule.updateKind,
          newDate: schedule.newDate,
          newTime: schedule.newTime,
          changesDate: schedule.changesDate,
          changesTime: schedule.changesTime,
        },
      });
      if (!await reflowScheduleChanges(tx, tripId, link)) return null;
      return true;
    });
    if (result === false) return NextResponse.json({ error: "Update type and affected item cannot be changed after creation" }, { status: 409 });
    if (!result) return NextResponse.json({ error: "Update not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (body?.action === "closePoll") {
    const pollId = Number(body.pollId);
    if (!Number.isInteger(pollId)) return NextResponse.json({ error: "Invalid poll" }, { status: 400 });
    const result = await prisma.poll.updateMany({ where: { id: pollId, tripId }, data: { isClosed: true } });
    if (!result.count) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = await ownedId(params);
  if (!tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const updateId = Number(body?.updateId);
  if (!Number.isInteger(updateId)) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const result = await prisma.$transaction(async (tx: TransactionClient) => {
    const update = await tx.tripUpdate.findFirst({ where: { id: updateId, tripId } });
    if (!update) return false;

    if (update.updateKind === "SCHEDULE_CHANGE") {
      const link: UpdateLink = {
        updateType: update.updateType as typeof UPDATE_TYPES[number],
        travelSegmentId: update.travelSegmentId,
        sourceTravelSegmentId: update.sourceTravelSegmentId,
        itineraryItemId: update.itineraryItemId,
      };
      await lockScheduleTarget(tx, tripId, link);
      const target = scheduleTarget(link);
      if (!target) {
        await tx.tripUpdate.delete({ where: { id: update.id } });
        return true;
      }
      const first = target ? await tx.tripUpdate.findFirst({
        where: { tripId, updateKind: "SCHEDULE_CHANGE", ...target },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }) : null;
      const base = first ? { date: first.originalDate, time: first.originalTime } : { date: update.originalDate, time: update.originalTime };
      await tx.tripUpdate.delete({ where: { id: update.id } });
      if (!await reflowScheduleChanges(tx, tripId, link, base)) return false;
      return true;
    }

    await tx.tripUpdate.delete({ where: { id: update.id } });
    return true;
  });
  return new Response(null, { status: result ? 204 : 404 });
}
