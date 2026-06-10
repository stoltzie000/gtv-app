import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";
import {
  parseDateOnly,
  parseText,
  parseTravelDirection,
  TRAVEL_SEGMENT_TYPES,
} from "@/lib/trips";
import { parseTripSummary } from "@/lib/trip-summary";

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
    if (description === null || notes === null || destination === null) {
      return NextResponse.json({ error: "Invalid overview" }, { status: 400 });
    }
    await prisma.trip.update({
      where: { id: tripId },
      data: { description, notes, destination },
    });
  } else if (body.action === "tripSummary") {
    const tripSummary = body.entries === null ? null : parseTripSummary(body.entries);
    if (body.entries !== null && !tripSummary) {
      return NextResponse.json({ error: "Enter valid trip summary milestones" }, { status: 400 });
    }
    await prisma.trip.update({
      where: { id: tripId },
      data: { tripSummary: tripSummary ?? Prisma.DbNull },
    });
  } else if (body.action === "travel") {
    const startLocation = parseText(body.startLocation);
    const destination = parseText(body.destination);
    if (startLocation === null || destination === null) {
      return NextResponse.json({ error: "Invalid travel details" }, { status: 400 });
    }
    await prisma.trip.update({
      where: { id: tripId },
      data: { startLocation, destination },
    });
  } else if (body.action === "reorderSegment") {
    const itemId = Number(body.itemId);
    const direction = body.direction === "up" ? -1 : body.direction === "down" ? 1 : 0;
    if (!Number.isInteger(itemId) || !direction) {
      return NextResponse.json({ error: "Invalid segment order" }, { status: 400 });
    }
    const segments = await prisma.travelSegment.findMany({
      where: { tripId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, position: true },
    });
    const index = segments.findIndex((segment) => segment.id === itemId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= segments.length) {
      return NextResponse.json({ error: "Segment cannot be moved further" }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.travelSegment.update({ where: { id: segments[index].id }, data: { position: segments[swapIndex].position } }),
      prisma.travelSegment.update({ where: { id: segments[swapIndex].id }, data: { position: segments[index].position } }),
    ]);
  } else if (body.action === "populateItinerary") {
    const mode = body.mode === "replace" ? "replace" : body.mode === "add" ? "add" : null;
    if (!mode) {
      return NextResponse.json({ error: "Choose whether to add to or replace the itinerary" }, { status: 400 });
    }
    const [trip, segments, itineraryCount] = await Promise.all([
      prisma.trip.findUnique({ where: { id: tripId }, select: { startDate: true, endDate: true } }),
      prisma.travelSegment.findMany({
        where: { tripId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      }),
      prisma.itineraryItem.count({ where: { tripId } }),
    ]);
    if (!trip || !segments.length) {
      return NextResponse.json({ error: "Add travel segments before populating the itinerary" }, { status: 400 });
    }
    if (itineraryCount && body.confirm !== true) {
      return NextResponse.json({ error: "Confirm before changing an existing itinerary" }, { status: 409 });
    }
    await prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.itineraryItem.deleteMany({ where: { tripId } });
      }
      await tx.itineraryItem.createMany({
        data: segments.map((segment) => ({
          tripId,
          sourceTravelSegmentId: segment.id,
          date: segment.date ?? (segment.returnForSegmentId ? trip.endDate : trip.startDate),
          time: segment.time || "00:00",
          title: `${segment.type}: ${segment.startLocation || "Start"} to ${segment.destination || "Destination"}`,
          description: [segment.title, segment.description].filter(Boolean).join("\n"),
        })),
      });
    });
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
    const date = body.date ? parseDateOnly(body.date) : null;
    const time = parseText(body.time) || null;
    const startLocation = parseText(body.startLocation);
    const destination = parseText(body.destination);
    const direction = parseTravelDirection(body.direction);
    if (!Number.isInteger(itemId) || !type || !title || description === null || startLocation === null || destination === null || !direction || (body.date && !date) || !TRAVEL_SEGMENT_TYPES.includes(type as never)) {
      return NextResponse.json({ error: "Invalid travel segment" }, { status: 400 });
    }
    const existing = await prisma.travelSegment.findFirst({ where: { id: itemId, tripId } });
    if (!existing) return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.travelSegment.update({
        where: { id: itemId },
        data: { type, title, description, date, time, startLocation, destination, direction, autoGenerated: false },
      });
      const generatedReturn = await tx.travelSegment.findFirst({
        where: { tripId, returnForSegmentId: itemId },
      });
      if (direction === "ROUND_TRIP" && !generatedReturn) {
        const last = await tx.travelSegment.aggregate({ where: { tripId }, _max: { position: true } });
        await tx.travelSegment.create({
          data: { tripId, type, title, description, startLocation: destination, destination: startLocation, direction: "ONE_WAY", returnForSegmentId: itemId, position: (last._max.position ?? -1) + 1, autoGenerated: true },
        });
      } else if (direction === "ROUND_TRIP" && generatedReturn?.autoGenerated) {
        await tx.travelSegment.update({
          where: { id: generatedReturn.id },
          data: { type, title, description, startLocation: destination, destination: startLocation },
        });
      } else if (direction === "ONE_WAY" && generatedReturn?.autoGenerated) {
        await tx.itineraryItem.deleteMany({ where: { tripId, sourceTravelSegmentId: generatedReturn.id } });
        await tx.travelSegment.delete({ where: { id: generatedReturn.id } });
      } else if (direction === "ONE_WAY" && generatedReturn) {
        await tx.travelSegment.update({ where: { id: generatedReturn.id }, data: { returnForSegmentId: null } });
      }
    });
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
    const date = body.date ? parseDateOnly(body.date) : null;
    const time = parseText(body.time) || null;
    const startLocation = parseText(body.startLocation);
    const destination = parseText(body.destination);
    const direction = parseTravelDirection(body.direction);
    if (!type || !title || description === null || startLocation === null || destination === null || !direction || (body.date && !date) || !TRAVEL_SEGMENT_TYPES.includes(type as never)) {
      return NextResponse.json({ error: "Invalid travel segment" }, { status: 400 });
    }
    const item = await prisma.$transaction(async (tx) => {
      const last = await tx.travelSegment.aggregate({ where: { tripId }, _max: { position: true } });
      const created = await tx.travelSegment.create({
        data: { tripId, type, title, description, date, time, startLocation, destination, direction, position: (last._max.position ?? -1) + 1 },
      });
      if (direction === "ROUND_TRIP") {
        await tx.travelSegment.create({
          data: { tripId, type, title, description, startLocation: destination, destination: startLocation, direction: "ONE_WAY", returnForSegmentId: created.id, position: created.position + 1, autoGenerated: true },
        });
      }
      return created;
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

  const segment = body?.action === "segment"
    ? await prisma.travelSegment.findFirst({ where: { id: itemId, tripId }, select: { returnForSegmentId: true } })
    : null;
  const result = body?.action === "itinerary"
    ? await prisma.itineraryItem.deleteMany({ where: { id: itemId, tripId } })
    : body?.action === "segment" && segment
      ? await prisma.$transaction(async (tx) => {
          if (segment.returnForSegmentId) {
            await tx.travelSegment.updateMany({ where: { id: segment.returnForSegmentId, tripId }, data: { direction: "ONE_WAY" } });
          }
          const generatedReturns = await tx.travelSegment.findMany({ where: { tripId, returnForSegmentId: itemId, autoGenerated: true }, select: { id: true } });
          const removedIds = [itemId, ...generatedReturns.map((item) => item.id)];
          await tx.travelSegment.updateMany({ where: { tripId, returnForSegmentId: itemId, autoGenerated: false }, data: { returnForSegmentId: null } });
          await tx.itineraryItem.deleteMany({ where: { tripId, sourceTravelSegmentId: { in: removedIds } } });
          await tx.travelSegment.deleteMany({ where: { tripId, id: { in: removedIds } } });
          return { count: 1 };
        })
      : null;

  if (!result?.count) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
