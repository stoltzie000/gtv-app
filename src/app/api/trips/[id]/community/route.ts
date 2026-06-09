import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";
import { parseText } from "@/lib/trips";

const UPDATE_TYPES = ["GENERAL", "TRAVEL", "ITINERARY"] as const;

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
    if (!title || !content || !link) return NextResponse.json({ error: "Title, update type, and affected item are required" }, { status: 400 });
    const update = await prisma.tripUpdate.create({ data: { tripId, title, content, ...link } });
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
    if (!Number.isInteger(updateId) || !title || !content || !link) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    const result = await prisma.tripUpdate.updateMany({ where: { id: updateId, tripId }, data: { title, content, ...link } });
    if (!result.count) return NextResponse.json({ error: "Update not found" }, { status: 404 });
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
