import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseTripInput,
  tripSelect,
  type TripInput,
} from "@/lib/trips";
import { touchTrip } from "@/lib/platform";

type UpdateTripBody = TripInput & { isPublished?: unknown };

async function getTripId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyToken();
  const id = await getTripId(params);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const trip = await prisma.trip.findFirst({
    where: { id, ownerId: session.userId },
    select: tripSelect,
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ trip });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyToken();
  const id = await getTripId(params);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  let body: UpdateTripBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let data;

  if (body.isPublished !== undefined) {
    if (typeof body.isPublished !== "boolean") {
      return NextResponse.json(
        { error: "Invalid publication state" },
        { status: 400 }
      );
    }
    data = { isPublished: body.isPublished, lastActivityAt: new Date(), draftReminderAt: null };
  } else {
    const input = parseTripInput(body);
    if (!input) {
      return NextResponse.json(
        { error: "Enter valid trip details and date range" },
        { status: 400 }
      );
    }
    data = {
      ...input,
      lastActivityAt: new Date(),
      draftReminderAt: null,
    };
  }

  const result = await prisma.trip.updateMany({
    where: { id, ownerId: session.userId },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const trip = await prisma.trip.findFirstOrThrow({
    where: { id, ownerId: session.userId },
    select: tripSelect,
  });

  await touchTrip(id, session.userId);

  return NextResponse.json({ trip });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyToken();
  const id = await getTripId(params);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const result = await prisma.trip.deleteMany({
    where: { id, ownerId: session.userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
