import { TravelerPolls } from "@/app/share/[token]/polls";
import { InlineLinkedUpdates, LinkedUpdateBadge, TravelerUpdateProvider, TravelerUpdatesFeed, TripWideUpdateBadge } from "./traveler-update-awareness";
import { resolveTripSummary } from "@/lib/trip-summary";
import { TravelerMediaViewer } from "./traveler-media-viewer";

type TravelerTrip = {
  id: number;
  tripName: string;
  tripType: string;
  startDate: Date;
  endDate: Date;
  travelerCount: number;
  description: string;
  notes: string;
  destination: string;
  startLocation: string;
  tripSummary: unknown;
  itineraryItems: Array<{ id: number; date: Date; time: string; title: string; description: string; sourceTravelSegmentId: number | null }>;
  travelSegments: Array<{ id: number; type: string; title: string; description: string; direction: string; returnForSegmentId: number | null; date: Date | null; time: string | null; startLocation: string; destination: string }>;
  documents: Array<{ id: number; name: string; size: number }>;
  photos: Array<{ id: number; name: string; size: number }>;
  updates: Array<{ id: number; title: string; content: string; createdAt: Date; updatedAt: Date; updateType: string; updateKind: string; travelSegmentId: number | null; sourceTravelSegmentId: number | null; itineraryItemId: number | null; originalDate: Date | null; originalTime: string | null; newDate: Date | null; newTime: string | null }>;
  polls: Array<{
    id: number;
    question: string;
    isClosed: boolean;
    options: Array<{ id: number; label: string; _count: { votes: number } }>;
    _count: { votes: number };
  }>;
};

function expirationAt(date: Date | null | undefined, time: string | null | undefined) {
  if (!date) return null;
  const [hours, minutes] = time?.match(/^\d{2}:\d{2}$/) ? time.split(":").map(Number) : [23, 59];
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, time ? 0 : 59, time ? 0 : 999);
}

export function TravelerTripView({ trip, publicToken, readOnly, initialNow }: { trip: TravelerTrip; publicToken: string; readOnly: boolean; initialNow: number }) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const mediaBase = readOnly
    ? `/api/trips/${trip.id}/media`
    : `/api/public/${publicToken}/media`;
  const tripSummary = resolveTripSummary(trip.tripSummary, trip);
  const updates = trip.updates.map((update) => {
    if (update.updateType === "GENERAL") return { ...update, expiresAt: null };
    if (update.updateType === "ITINERARY") {
      const item = trip.itineraryItems.find((candidate) => candidate.id === update.itineraryItemId);
      return { ...update, expiresAt: expirationAt(item?.date ?? update.newDate, item?.time ?? update.newTime) };
    }
    const segment = trip.travelSegments.find((candidate) => candidate.id === update.sourceTravelSegmentId);
    const generatedItem = trip.itineraryItems.find((candidate) => candidate.sourceTravelSegmentId === update.sourceTravelSegmentId);
    return { ...update, expiresAt: expirationAt(segment?.date ?? generatedItem?.date ?? update.newDate, segment?.time ?? generatedItem?.time ?? update.newTime) };
  });
  const travelUpdates = (id: number) => updates.filter((update) => update.updateType === "TRAVEL"
    && update.sourceTravelSegmentId !== null
    && update.sourceTravelSegmentId === id);
  const itineraryUpdates = (item: TravelerTrip["itineraryItems"][number]) => {
    const linkedUpdates = updates.filter((update) => (
      update.updateType === "ITINERARY" && update.itineraryItemId === item.id
    ) || (
      update.updateType === "TRAVEL"
      && item.sourceTravelSegmentId !== null
      && update.sourceTravelSegmentId !== null
      && update.sourceTravelSegmentId === item.sourceTravelSegmentId
    ));
    return [...new Map(linkedUpdates.map((update) => [update.id, update])).values()]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  };
  const generalUpdates = updates.filter((update) => update.updateType === "GENERAL");
  const renderSegments = (segments: TravelerTrip["travelSegments"]) => segments.length
    ? <div className="grid gap-3">{segments.map((segment) => { const linkedUpdates = travelUpdates(segment.id); return <div className="border rounded p-4 text-gray-900" id={`travel-segment-${segment.id}`} key={segment.id}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold uppercase text-gray-700">{segment.type}</p><LinkedUpdateBadge updates={linkedUpdates} /></div><h3 className="text-lg font-semibold text-gray-950">{segment.title}</h3>{(segment.date || segment.time) && <p className="text-base text-gray-800">{segment.date ? dateFormatter.format(segment.date) : ""}{segment.date && segment.time ? " at " : ""}{segment.time ?? ""}</p>}{(segment.startLocation || segment.destination) && <p>{segment.startLocation || "Start"} to {segment.destination || "Destination"}</p>}{segment.description && <p className="whitespace-pre-wrap">{segment.description}</p>}<InlineLinkedUpdates updates={linkedUpdates} /></div>; })}</div>
    : <p className="text-gray-900">No travel segments yet.</p>;

  return (
    <TravelerUpdateProvider initialNow={initialNow}><article className="grid gap-8 text-base text-gray-900">
      <section className="bg-white border rounded-lg p-6 shadow-sm sm:p-8" id="overview">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-950">Overview</h2>
          <TripWideUpdateBadge updates={updates} />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">{trip.tripType}</p>
        <h1 className="mb-3 text-4xl font-bold text-gray-950">{trip.tripName}</h1>
        {trip.destination && <p className="text-xl mb-4">{trip.destination}</p>}
        {trip.description && <p className="whitespace-pre-wrap mb-4">{trip.description}</p>}
        {trip.notes && <p className="whitespace-pre-wrap text-gray-900 mb-4">{trip.notes}</p>}
        <div className="grid gap-6 sm:grid-cols-2">
          <div><h2 className="font-semibold text-gray-800">Trip Dates</h2><p>Leaves home: {dateFormatter.format(trip.startDate)}<br />Returns home: {dateFormatter.format(trip.endDate)}</p></div>
          <div><h2 className="font-semibold text-gray-800">Travelers</h2><p>{trip.travelerCount} traveler{trip.travelerCount === 1 ? "" : "s"}</p></div>
        </div>
        {tripSummary.length > 0 && <div className="mt-6 border-t pt-5"><h2 className="text-xl font-bold text-gray-950 mb-3">Trip Summary</h2><ol className="grid gap-2">{tripSummary.map((entry, index) => <li className="grid gap-1 sm:grid-cols-[7rem_1fr]" key={`${entry.date}-${index}`}><time className="font-semibold text-gray-900" dateTime={entry.date}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${entry.date}T00:00:00.000Z`))}</time><span>{entry.title}</span></li>)}</ol></div>}
      </section>

      {generalUpdates.length > 0 && <section className="bg-white border rounded-lg p-6 text-gray-900" id="notices"><h2 className="text-xl font-bold text-gray-950 mb-3">Trip Notices</h2><TravelerUpdatesFeed updates={generalUpdates} /></section>}

      <nav aria-label="Trip sections" className="flex flex-wrap gap-3 text-sm">
        {["overview", ...(generalUpdates.length ? ["notices"] : []), "travel", "itinerary", "documents", "photos", "polls"].map((section) => <a className="font-medium text-blue-800 hover:underline capitalize" href={`#${section}`} key={section}>{section === "notices" ? "Trip Notices" : section}</a>)}
      </nav>

      <section className="bg-white border rounded-lg p-6 sm:p-8" id="travel"><h2 className="text-2xl font-bold text-gray-950 mb-4">Travel</h2>
        {(trip.startLocation || trip.destination) && <p className="mb-4">{trip.startLocation || "Start"} to {trip.destination || "Destination"}</p>}
        {renderSegments(trip.travelSegments)}
      </section>

      <section className="bg-white border rounded-lg p-6 sm:p-8" id="itinerary"><h2 className="text-2xl font-bold text-gray-950 mb-4">Itinerary</h2>
        {trip.itineraryItems.length ? <div className="grid gap-4">{trip.itineraryItems.map((item) => { const linkedUpdates = itineraryUpdates(item); return <div className="border-l-4 border-blue-600 pl-4 text-gray-900" id={`itinerary-item-${item.id}`} key={item.id}><div className="flex items-center justify-between gap-3"><p className="font-semibold text-gray-900">{dateFormatter.format(item.date)} at {item.time}</p><LinkedUpdateBadge updates={linkedUpdates} /></div><h3 className="text-xl font-semibold text-gray-950">{item.title}</h3>{item.description && <p className="whitespace-pre-wrap">{item.description}</p>}<InlineLinkedUpdates updates={linkedUpdates} /></div>; })}</div> : <p className="text-gray-900">No itinerary items yet.</p>}
      </section>

      <TravelerMediaViewer documents={trip.documents} mediaBase={mediaBase} photos={trip.photos} />

      <div id="polls"><TravelerPolls
          polls={trip.polls.map((poll) => ({ id: poll.id, question: poll.question, isClosed: poll.isClosed, totalVotes: poll._count.votes, options: poll.options.map((option) => ({ id: option.id, label: option.label, votes: option._count.votes })) }))}
          readOnly={readOnly}
          token={publicToken}
        /></div>
    </article></TravelerUpdateProvider>
  );
}
