import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TripActions } from "./trip-actions";
import { StatusBadge } from "@/app/components/status-badge";
import { TripSections } from "./trip-sections";
import { TripCommunity } from "./trip-community";

export default async function TripDetailPage({
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
      documents: { select: { id: true, name: true, size: true }, orderBy: { createdAt: "desc" } },
      photos: { select: { id: true, name: true, size: true }, orderBy: { createdAt: "desc" } },
      updates: { orderBy: { createdAt: "desc" } },
      polls: { orderBy: { createdAt: "desc" }, include: { options: { include: { _count: { select: { votes: true } } } }, _count: { select: { votes: true } } } },
    },
  });

  if (!trip) {
    notFound();
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link className="text-blue-600" href="/dashboard">
        Back to Dashboard
      </Link>

      <div className="flex items-center gap-3 mt-8 mb-6">
        <h1 className="text-4xl font-bold">{trip.tripName}</h1>
        <StatusBadge status={trip.status} />
      </div>

      <dl className="grid gap-3">
        <div>
          <dt className="font-semibold">Trip Type</dt>
          <dd>{trip.tripType}</dd>
        </div>
        <div>
          <dt className="font-semibold">Trip Dates</dt>
          <dd>
            Leaves home: {trip.startDate.toISOString().slice(0, 10)}<br />
            Returns home: {trip.endDate.toISOString().slice(0, 10)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Travelers</dt>
          <dd>{trip.travelerCount}</dd>
        </div>
        <div>
          <dt className="font-semibold">Traveler visibility</dt>
          <dd>{trip.isPublished ? "Published" : "Unpublished"}</dd>
        </div>
      </dl>

      <TripActions
        id={trip.id}
        isPublished={trip.isPublished}
        tripName={trip.tripName}
      />
      <TripSections
        description={trip.description}
        destination={trip.destination}
        documents={trip.documents}
        itinerary={trip.itineraryItems.map((item) => ({ id: item.id, date: item.date.toISOString().slice(0, 10), time: item.time, title: item.title, description: item.description }))}
        notes={trip.notes}
        photos={trip.photos}
        segments={trip.travelSegments.map((item) => ({ id: item.id, type: item.type, title: item.title, description: item.description }))}
        startLocation={trip.startLocation}
        statuses={{ overview: trip.overviewStatus, itinerary: trip.itineraryStatus, travel: trip.travelStatus, documents: trip.documentsStatus, photos: trip.photosStatus }}
        tripId={trip.id}
      />
      <TripCommunity
        initialShareToken={trip.shareToken}
        polls={trip.polls.map((poll) => ({ id: poll.id, question: poll.question, isClosed: poll.isClosed, totalVotes: poll._count.votes, options: poll.options.map((option) => ({ id: option.id, label: option.label, votes: option._count.votes })) }))}
        tripId={trip.id}
        updates={trip.updates.map((update) => ({ id: update.id, title: update.title, content: update.content, createdAt: update.createdAt.toISOString() }))}
      />
    </main>
  );
}
