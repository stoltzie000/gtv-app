export type TripSummaryEntry = {
  date: string;
  title: string;
};

type SummarySource = {
  startDate: Date | string;
  endDate: Date | string;
  destination: string;
  startLocation?: string;
  itineraryItems: Array<{
    date: Date | string;
    title: string;
    description?: string;
    sourceTravelSegmentId?: number | null;
  }>;
  travelSegments: Array<{
    date: Date | string | null;
    type?: string;
    title: string;
    description?: string;
    startLocation?: string;
    destination?: string;
    returnForSegmentId?: number | null;
  }>;
};

type Candidate = TripSummaryEntry & {
  priority: number;
  order: number;
};

const GENERIC_TITLE = /^(?:day\s*\d+|\d+|tbd|to be determined|free day|activity|event|travel|trip begins|departure|arrival)$/i;
const AT_SEA = /\b(?:at sea|day at sea|sea day)\b/i;
const DEPARTURE = /\b(?:depart|departure|embark|board)\b/i;
const ARRIVAL = /\b(?:arriv\w*|return(?:ing)? back|disembark\w*)\b/i;
const STATE_CODES = new Set(["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"]);

function dateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function cleanText(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function displayLocation(value: string | undefined) {
  const location = cleanText(value);
  if (!location || /^(?:start|destination|unknown|n\/a)$/i.test(location)) return "";
  if (location === location.toLowerCase()) {
    return location.split(/\s+/).map((word) => {
      const upper = word.toUpperCase();
      if (STATE_CODES.has(upper) || /^[a-z]{3}$/i.test(word)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(" ");
  }
  return location;
}

function meaningfulTitle(value: string | undefined) {
  const title = cleanText(value);
  return title && !GENERIC_TITLE.test(title) ? title : "";
}

function sameLocation(left: string | undefined, right: string | undefined) {
  return normalize(left ?? "") === normalize(right ?? "");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function travelMilestone(segment: SummarySource["travelSegments"][number], source: SummarySource) {
  const type = cleanText(segment.type).toLowerCase();
  const title = meaningfulTitle(segment.title);
  const description = cleanText(segment.description);
  const start = displayLocation(segment.startLocation);
  const destination = displayLocation(segment.destination);
  const returningHome = Boolean(segment.returnForSegmentId)
    || Boolean(destination && source.startLocation && sameLocation(destination, source.startLocation));

  if (type === "flight") {
    if (returningHome) return "Return Flight Home";
    if (destination) return `Flight to ${destination}`;
    if (title) return title.match(/\bflight\b/i) ? title : `Flight: ${title}`;
  }

  if (type === "cruise") {
    if (DEPARTURE.test(description) && !title) return "Board Cruise Ship";
    if (/glacier/i.test(description) && destination) return destination;
    if (AT_SEA.test(description) || AT_SEA.test(start)) return "At Sea";
    if (destination) return destination;
    if (ARRIVAL.test(description)) return "Disembark Cruise Ship";
    if (title) return title.match(/\bcruise\b/i) ? title : `Cruise: ${title}`;
  }

  if (type === "hotel") {
    if (title) return title.match(/\bhotel|resort|inn|lodge\b/i) ? title : `Hotel: ${title}`;
    if (destination) return `Hotel in ${destination}`;
  }

  if (title) return title;
  if (destination) {
    const label = cleanText(segment.type) || "Travel";
    return `${label} to ${destination}`;
  }
  if (description && !GENERIC_TITLE.test(description)) return description;
  return "";
}

function fallbackSummary(source: SummarySource) {
  const start = new Date(`${dateOnly(source.startDate)}T00:00:00.000Z`);
  const end = new Date(`${dateOnly(source.endDate)}T00:00:00.000Z`);
  const entries: TripSummaryEntry[] = [];
  for (let date = start, day = 1; date <= end && day <= 60; date = new Date(date.getTime() + 86_400_000), day += 1) {
    entries.push({ date: date.toISOString().slice(0, 10), title: `Day ${day}` });
  }
  return entries;
}

export function parseTripSummary(value: unknown): TripSummaryEntry[] | null {
  if (!Array.isArray(value)) return null;

  const entries = value.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const date = "date" in entry && typeof entry.date === "string" ? entry.date : "";
    const title = "title" in entry && typeof entry.title === "string" ? entry.title.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || title.length > 120) return null;
    return { date, title };
  });

  if (entries.some((entry) => entry === null) || entries.length > 60) return null;
  return (entries as TripSummaryEntry[]).sort((left, right) => left.date.localeCompare(right.date));
}

export function deriveTripSummary(source: SummarySource): TripSummaryEntry[] {
  const candidates: Candidate[] = [];

  source.travelSegments.forEach((segment, order) => {
    if (!segment.date) return;
    const title = travelMilestone(segment, source);
    if (title) candidates.push({ date: dateOnly(segment.date), title, priority: 1, order });
  });

  source.itineraryItems.forEach((item, order) => {
    if (item.sourceTravelSegmentId) return;
    const title = meaningfulTitle(item.title);
    if (title) candidates.push({ date: dateOnly(item.date), title, priority: 2, order });
  });

  if (!candidates.length) return fallbackSummary(source);

  const usedTitles = new Set<string>();
  const usedDates = new Set<string>();
  return candidates
    .sort((left, right) => left.date.localeCompare(right.date)
      || left.priority - right.priority
      || left.order - right.order)
    .filter((candidate) => {
      const titleKey = normalize(candidate.title);
      if (!titleKey || usedDates.has(candidate.date) || usedTitles.has(titleKey)) return false;
      usedDates.add(candidate.date);
      usedTitles.add(titleKey);
      return true;
    })
    .map(({ date, title }) => ({ date, title }));
}

export function resolveTripSummary(value: unknown, source: SummarySource) {
  return parseTripSummary(value) ?? deriveTripSummary(source);
}
