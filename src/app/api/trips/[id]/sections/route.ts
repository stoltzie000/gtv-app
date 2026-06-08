import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";
import {
  parseDateOnly,
  parseText,
  parseTripStatus,
  TRAVEL_SEGMENT_TYPES,
} from "@/lib/trips";

async function ownedId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return null;
  const owned = await getOwnedTripId(id);
  return owned.session && owned.tripId ? owned.tripId : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tripId = await ownedId(params);
  if (!tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.action === "overview") {
    const description = parseText(body.description);
    const notes = parseText(body.notes);
    const destination = parseText(body.destination);
    const status = parseTripStatus(body.status);
    if (description === null || notes === null || destination === null || !status) {
      return NextResponse.json({ error: "Invalid overview" }, { status: 400 });
    }
    await prisma.trip.update({
      where: { id: tripId },
      data: { description, notes, destination, overviewStatus: status },
    });
  } else if (body.action === "travel") {
    const startLocation = parseText(body.startLocation);
    const destination = parseText(body.destination);
    const status = parseTripStatus(body.status);
    if (startLocation === null || destination === null || !status) {
      return NextResponse.json({ error: "Invalid travel details" }, { status: 400 });
    }
    await prisma.trip.update({
      where: { id: tripId },
      data: { startLocation, destination, travelStatus: status },
    });
  } else if (body.action === "sectionStatus") {
    const status = parseTripStatus(body.status);
    const fields = {
      itinerary: "itineraryStatus",
      documents: "documentsStatus",
      photos: "photosStatus",
    } as const;
    const field = fields[body.section as keyof typeof fields];
    if (!field || !status) {
      return NextResponse.json({ error: "Invalid section status" }, { status: 400 });
    }
    await prisma.trip.update({ where: { id: tripId }, data: { [field]: status } });
  } else if (body.action === "itinerary") {
    const itemId = Number(body.itemId);
    const date = parseDateOnly(body.date);
    const time = parseText(body.time, true);
    const title = parseText(body.title, true);
    const description = parseText(body.description);
    if (!Number.isInteger(itemId) || !date || !time || !title || description === null) {
      return NextResponse.json({ error: "Invalid itinerary item" }, { status: 400 });
    }
    const result = await prisma.itineraryItem.updateMany({
      where: { id: itemId, tripId },
      data: { date, time, title, description },
    });
    if (!result.count) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  } else if (body.action === "segment") {
    const itemId = Number(body.itemId);
    const type = parseText(body.type, true);
    const title = parseText(body.title, true);
    const description = parseText(body.description);
    if (!Number.isInteger(itemId) || !type || !title || description === null || !TRAVEL_SEGMENT_TYPES.includes(type as never)) {
      return NextResponse.json({ error: "Invalid travel segment" }, { status: 400 });
    }
    const result = await prisma.travelSegment.updateMany({
      where: { id: itemId, tripId },
      data: { type, title, description },
    });
    if (!result.count) return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tripId = await ownedId(params);
  if (!tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const body = await request.json().catch(() => null);

  if (body?.action === "itinerary") {
    const date = parseDateOnly(body.date);
    const time = parseText(body.time, true);
    const title = parseText(body.title, true);
    const description = parseText(body.description);
    if (!date || !time || !title || description === null) {
      return NextResponse.json({ error: "Invalid itinerary item" }, { status: 400 });
    }
    const item = await prisma.itineraryItem.create({
      data: { tripId, date, time, title, description },
    });
    return NextResponse.json({ item }, { status: 201 });
  }

  if (body?.action === "segment") {
    const type = parseText(body.type, true);
    const title = parseText(body.title, true);
    const description = parseText(body.description);
    if (!type || !title || description === null || !TRAVEL_SEGMENT_TYPES.includes(type as never)) {
      return NextResponse.json({ error: "Invalid travel segment" }, { status: 400 });
    }
    const item = await prisma.travelSegment.create({
      data: { tripId, type, title, description },
    });
    return NextResponse.json({ item }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tripId = await ownedId(params);
  if (!tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const itemId = Number(body?.itemId);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  }

  const result = body?.action === "itinerary"
    ? await prisma.itineraryItem.deleteMany({ where: { id: itemId, tripId } })
    : body?.action === "segment"
      ? await prisma.travelSegment.deleteMany({ where: { id: itemId, tripId } })
      : null;

  if (!result?.count) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
