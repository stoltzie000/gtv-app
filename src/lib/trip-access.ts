import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { touchTrip } from "@/lib/platform";

export async function getOwnedTripId(tripId: number) {
  const session = await verifyToken();
  if (!session) return { session: null, tripId: null };

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, ownerId: session.userId },
    select: { id: true },
  });

  if (trip) {
    await touchTrip(trip.id, session.userId);
  }

  return { session, tripId: trip?.id ?? null };
}
