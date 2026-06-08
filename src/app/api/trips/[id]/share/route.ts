import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const owned = Number.isInteger(id) ? await getOwnedTripId(id) : null;
  if (!owned?.session || !owned.tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const current = await prisma.trip.findUnique({ where: { id: owned.tripId }, select: { shareToken: true } });
  const shareToken = current?.shareToken ?? randomUUID();
  if (!current?.shareToken) await prisma.trip.update({ where: { id: owned.tripId }, data: { shareToken } });
  return NextResponse.json({ shareToken });
}
