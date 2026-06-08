import { notFound, redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTripStatus, tripSelect } from "@/lib/trips";
import { EditTripForm } from "./edit-trip-form";

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyToken();
  if (!session) redirect("/login");

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const trip = await prisma.trip.findFirst({
    where: { id, ownerId: session.userId },
    select: tripSelect,
  });
  if (!trip) notFound();

  const status = parseTripStatus(trip.status);
  if (!status) notFound();

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Edit Trip</h1>
      <EditTripForm trip={{
        id: trip.id,
        tripName: trip.tripName,
        tripType: trip.tripType,
        startDate: trip.startDate.toISOString().slice(0, 10),
        endDate: trip.endDate.toISOString().slice(0, 10),
        travelerCount: trip.travelerCount,
        status,
      }} />
    </main>
  );
}
