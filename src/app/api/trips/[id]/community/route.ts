import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";
import { parseDateOnly, parseText } from "@/lib/trips";

const UPDATE_TYPES = ["GENERAL", "TRAVEL", "ITINERARY"] as const;
const UPDATE_KINDS = ["INFORMATIONAL", "SCHEDULE_CHANGE"] as const;

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

function parseSchedule(body: Record<string, unknown>, updateType: typeof UPDATE_TYPES[number]) {
  if (updateType === "GENERAL") return { updateKind: "INFORMATIONAL" as const, newDate: null, newTime: null };
  const requestedKind = UPDATE_KINDS.includes(body.updateKind as typeof UPDATE_KINDS[number])
    ? body.updateKind as typeof UPDATE_KINDS[number]
    : null;
  if (!requestedKind) return null;
  const updateKind = requestedKind;
  if (updateKind === "INFORMATIONAL") return { updateKind, newDate: null, newTime: null };

  const rawDate = typeof body.newDate === "string" ? body.newDate.trim() : "";
  const rawTime = typeof body.newTime === "string" ? body.newTime.trim() : "";
  const newDate = rawDate ? parseDateOnly(rawDate) : null;
  const newTime = rawTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : null;
  if ((rawDate && !newDate) || (rawTime && !newTime) || (!newDate && !newTime)) return null;
  return { updateKind, newDate, newTime };
}

async function applyScheduleChange(
  tx: Prisma.TransactionClient,
  tripId: number,
  link: NonNullable<Awaited<ReturnType<typeof parseUpdateLink>>>,
  schedule: NonNullable<ReturnType<typeof parseSchedule>>,
  existing?: { originalDate: Date | null; originalTime: string | null }
) {
  if (schedule.updateKind !== "SCHEDULE_CHANGE") {
    return { originalDate: null, originalTime: null, newDate: null, newTime: null };
  }

  if (link.updateType === "TRAVEL" && link.travelSegmentId) {
    const segment = await tx.travelSegment.findFirst({ where: { id: link.travelSegmentId, tripId } });
    if (!segment) return null;
    const effectiveDate = schedule.newDate ?? segment.date;
    const effectiveTime = schedule.newTime ?? segment.time;
    await tx.travelSegment.update({ where: { id: segment.id }, data: { date: effectiveDate, time: effectiveTime } });
    await tx.itineraryItem.updateMany({
      where: { tripId, sourceTravelSegmentId: link.sourceTravelSegmentId },
      data: { ...(effectiveDate ? { date: effectiveDate } : {}), ...(effectiveTime ? { time: effectiveTime } : {}) },
    });
    return {
      originalDate: existing?.originalDate ?? segment.date,
      originalTime: existing?.originalTime ?? segment.time,
      newDate: effectiveDate,
      newTime: effectiveTime,
    };
  }

  if (link.updateType === "ITINERARY" && link.itineraryItemId) {
    const item = await tx.itineraryItem.findFirst({ where: { id: link.itineraryItemId, tripId } });
    if (!item) return null;
    const effectiveDate = schedule.newDate ?? item.date;
    const effectiveTime = schedule.newTime ?? item.time;
    await tx.itineraryItem.update({ where: { id: item.id }, data: { date: effectiveDate, time: effectiveTime } });
    return {
      originalDate: existing?.originalDate ?? item.date,
      originalTime: existing?.originalTime ?? item.time,
      newDate: effectiveDate,
      newTime: effectiveTime,
    };
  }
  return null;
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
    const update = await prisma.$transaction(async (tx) => {
      const scheduleData = await applyScheduleChange(tx, tripId, link, schedule);
      if (!scheduleData) return null;
      return tx.tripUpdate.create({ data: { tripId, title, content, ...link, updateKind: schedule.updateKind, ...scheduleData } });
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
    const schedule = link ? parseSchedule(body, link.updateType) : null;
    if (!Number.isInteger(updateId) || !title || !content || !link || !schedule) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.tripUpdate.findFirst({ where: { id: updateId, tripId } });
      if (!existing) return null;
      if (existing.updateType !== link.updateType
        || existing.travelSegmentId !== link.travelSegmentId || existing.itineraryItemId !== link.itineraryItemId) return false;
      if (existing.updateKind === "SCHEDULE_CHANGE" && schedule.updateKind !== "SCHEDULE_CHANGE") return false;
      const scheduleData = await applyScheduleChange(tx, tripId, link, schedule, existing);
      if (!scheduleData) return null;
      await tx.tripUpdate.update({ where: { id: updateId }, data: { title, content, updateKind: schedule.updateKind, ...scheduleData } });
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
  const result = await prisma.tripUpdate.deleteMany({ where: { id: updateId, tripId } });
  return new Response(null, { status: result.count ? 204 : 404 });
}
