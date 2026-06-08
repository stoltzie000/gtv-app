import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTripInput, tripSelect, type TripInput } from "@/lib/trips";

export async function GET() {
  const session = await verifyToken();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      lastActivityAt: new Date(),
      inactiveAt: null,
      inactivityWarningAt: null,
    },
  });

  const trips = await prisma.trip.findMany({
    where: { ownerId: session.userId },
    orderBy: { createdAt: "desc" },
    select: tripSelect,
  });

  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
  const session = await verifyToken();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TripInput;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const input = parseTripInput(body);

  if (!input) {
    return NextResponse.json(
      { error: "Enter valid trip details and date range" },
      { status: 400 }
    );
  }

  const trip = await prisma.trip.create({
    data: {
      ...input,
      ownerId: session.userId,
    },
    select: tripSelect,
  });

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      lastActivityAt: new Date(),
      inactiveAt: null,
      inactivityWarningAt: null,
    },
  });

  return NextResponse.json({ trip }, { status: 201 });
}
