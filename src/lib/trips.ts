export type TripInput = {
  tripName?: unknown;
  tripType?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  travelerCount?: unknown;
  status?: unknown;
};

export const TRIP_STATUSES = [
  "Not Started",
  "In Progress",
  "Completed",
  "Optional",
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const tripSelect = {
  id: true,
  tripName: true,
  tripType: true,
  startDate: true,
  endDate: true,
  travelerCount: true,
  status: true,
  isPublished: true,
  shareToken: true,
  createdAt: true,
  overviewStatus: true,
  itineraryStatus: true,
  travelStatus: true,
  documentsStatus: true,
  photosStatus: true,
  lastActivityAt: true,
  draftReminderAt: true,
} as const;

export const TRAVEL_SEGMENT_TYPES = [
  "Car",
  "Flight",
  "Cruise",
  "Hotel",
  "Train",
  "Bus",
  "Custom",
] as const;

export const TRIP_DIRECTIONS = ["ONE_WAY", "ROUND_TRIP"] as const;
export type TripDirection = (typeof TRIP_DIRECTIONS)[number];

export function parseTripDirection(value: unknown): TripDirection | null {
  return typeof value === "string" && TRIP_DIRECTIONS.includes(value as TripDirection)
    ? value as TripDirection
    : null;
}

export function parseText(value: unknown, required = false) {
  const text = typeof value === "string" ? value.trim() : "";
  return required && !text ? null : text;
}

export function parseDateOnly(value: unknown) {
  return parseDate(value);
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

export function parseTripStatus(value: unknown): TripStatus | null {
  return typeof value === "string" &&
    TRIP_STATUSES.includes(value as TripStatus)
    ? (value as TripStatus)
    : null;
}

export function parseTripInput(body: TripInput) {
  const tripName =
    typeof body.tripName === "string" ? body.tripName.trim() : "";
  const tripType =
    typeof body.tripType === "string" ? body.tripType.trim() : "";
  const startDate = parseDate(body.startDate);
  const endDate = parseDate(body.endDate);
  const travelerCount = Number(body.travelerCount);

  if (
    !tripName ||
    !tripType ||
    !startDate ||
    !endDate ||
    endDate < startDate ||
    !Number.isInteger(travelerCount) ||
    travelerCount < 1
  ) {
    return null;
  }

  return { tripName, tripType, startDate, endDate, travelerCount };
}
