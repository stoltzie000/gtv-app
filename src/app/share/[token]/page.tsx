import { notFound } from "next/navigation";
import { getPublishedTrip } from "@/lib/public-trip";
import { TravelerTripView } from "@/app/trips/[id]/preview/traveler-trip-view";
import { prisma } from "@/lib/prisma";

export default async function PublicTripPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ source?: string }> }) {
  const { token } = await params;
  const trip = await getPublishedTrip(token);
  if (!trip) notFound();

  const source = (await searchParams).source;
  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      travelerViewCount: { increment: 1 },
      ...(source === "qr" ? { qrScanCount: { increment: 1 } } : {}),
    },
  });

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <TravelerTripView trip={trip} publicToken={token} readOnly={false} />
      </div>
    </main>
  );
}
