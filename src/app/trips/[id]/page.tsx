import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TripActions } from "./trip-actions";
import { TripSections } from "./trip-sections";
import { TripPolls, TripUpdates } from "./trip-community";
import { Notification } from "@/app/components/notification";
import { deriveTripSummary, parseTripSummary } from "@/lib/trip-summary";

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
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
      travelSegments: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      documents: { select: { id: true, name: true, size: true }, orderBy: { createdAt: "desc" } },
      photos: { select: { id: true, name: true, size: true }, orderBy: { createdAt: "desc" } },
      updates: { orderBy: { createdAt: "desc" } },
      polls: { orderBy: { createdAt: "desc" }, include: { options: { include: { _count: { select: { votes: true } } } }, _count: { select: { votes: true } } } },
    },
  });

  if (!trip) {
    notFound();
  }
  const notice = (await searchParams).notice;
  const summarySource = {
    startDate: trip.startDate,
    endDate: trip.endDate,
    destination: trip.destination,
    startLocation: trip.startLocation,
    itineraryItems: trip.itineraryItems,
    travelSegments: trip.travelSegments,
  };
  const generatedTripSummary = deriveTripSummary(summarySource);
  const savedTripSummary = parseTripSummary(trip.tripSummary);

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link className="text-blue-600" href="/dashboard">
        Back to Dashboard
      </Link>
      {notice === "trip-saved" && <Notification className="mt-6" message="Trip saved." type="success" />}

      <div className="mt-8 mb-6">
        <h1 className="text-4xl font-bold">{trip.tripName}</h1>
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
      <nav aria-label="Trip sections" className="mt-6 flex flex-wrap gap-3 text-sm">
        {["overview", "updates", "travel", "itinerary", "documents", "photos", "polls"].map((section) => <a className="text-blue-700 hover:underline capitalize" href={`#${section}`} key={section}>{section}</a>)}
      </nav>
      <TripSections
        description={trip.description}
        destination={trip.destination}
        documents={trip.documents}
        itinerary={trip.itineraryItems.map((item) => ({ id: item.id, date: item.date.toISOString().slice(0, 10), time: item.time, title: item.title, description: item.description }))}
        notes={trip.notes}
        photos={trip.photos}
        updatesSection={<TripUpdates itineraryItems={trip.itineraryItems.map((item) => ({ id: item.id, label: `${item.date.toISOString().slice(0, 10)} ${item.time} - ${item.title}`, date: item.date.toISOString().slice(0, 10), time: item.time }))} travelSegments={trip.travelSegments.map((item) => ({ id: item.id, label: `${item.type} - ${item.title}`, date: item.date?.toISOString().slice(0, 10) ?? null, time: item.time }))} tripId={trip.id} updates={trip.updates.map((update) => ({ id: update.id, title: update.title, content: update.content, createdAt: update.createdAt.toISOString(), updateType: update.updateType as "GENERAL" | "TRAVEL" | "ITINERARY", updateKind: update.updateKind as "INFORMATIONAL" | "SCHEDULE_CHANGE", travelSegmentId: update.travelSegmentId, itineraryItemId: update.itineraryItemId, originalDate: update.originalDate?.toISOString().slice(0, 10) ?? null, originalTime: update.originalTime, newDate: update.newDate?.toISOString().slice(0, 10) ?? null, newTime: update.newTime }))} />}
        pollsSection={<TripPolls initialShareToken={trip.shareToken} polls={trip.polls.map((poll) => ({ id: poll.id, question: poll.question, isClosed: poll.isClosed, totalVotes: poll._count.votes, options: poll.options.map((option) => ({ id: option.id, label: option.label, votes: option._count.votes })) }))} tripId={trip.id} />}
        segments={trip.travelSegments.map((item) => ({ id: item.id, type: item.type, title: item.title, description: item.description, date: item.date?.toISOString().slice(0, 10), time: item.time ?? "", startLocation: item.startLocation, destination: item.destination, direction: item.direction, returnForSegmentId: item.returnForSegmentId, autoGenerated: item.autoGenerated }))}
        startLocation={trip.startLocation}
        tripSummary={savedTripSummary ?? generatedTripSummary}
        tripSummaryIsCustom={savedTripSummary !== null}
        generatedTripSummary={generatedTripSummary}
        tripId={trip.id}
      />
    </main>
  );
}
