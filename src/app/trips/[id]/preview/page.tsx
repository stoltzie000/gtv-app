import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TravelerTripView } from "./traveler-trip-view";

export default async function TripPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifyToken();

  if (!session) {
    redirect("/login");
  }

  const id = Number((await params).id);

  if (!Number.isInteger(id) || id < 1) {
    notFound();
  }

  const trip = await prisma.trip.findFirst({
    where: { id, ownerId: session.userId },
    include: {
      itineraryItems: { orderBy: [{ date: "asc" }, { time: "asc" }] },
      travelSegments: { orderBy: { createdAt: "asc" } },
      documents: { select: { id: true, name: true, size: true } },
      photos: { select: { id: true, name: true, size: true } },
      updates: { orderBy: { createdAt: "desc" } },
      polls: {
        orderBy: { createdAt: "desc" },
        include: { options: { include: { _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
      },
    },
  });

  if (!trip) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="font-semibold">Traveler Preview</p>
            <p className="text-sm text-gray-600">
              {trip.isPublished ? "Currently published" : "Currently unpublished"}
            </p>
          </div>
          <Link className="text-blue-600" href={`/trips/${trip.id}`}>
            Exit Preview
          </Link>
        </div>

        <TravelerTripView publicToken={trip.shareToken ?? "preview"} readOnly trip={trip} />
      </div>
    </main>
  );
}
