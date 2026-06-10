export type TripInput = {
  tripName?: unknown;
  tripType?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  travelerCount?: unknown;
};

export const tripSelect = {
  id: true,
  tripName: true,
  tripType: true,
  startDate: true,
  endDate: true,
  travelerCount: true,
  isPublished: true,
  shareToken: true,
  createdAt: true,
  lastActivityAt: true,
  draftReminderAt: true,
  _count: { select: { updates: true, polls: true } },
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

export const TRAVEL_DIRECTIONS = ["ONE_WAY", "ROUND_TRIP"] as const;
export type TravelDirection = (typeof TRAVEL_DIRECTIONS)[number];

export function parseTravelDirection(value: unknown): TravelDirection | null {
  return typeof value === "string" && TRAVEL_DIRECTIONS.includes(value as TravelDirection)
    ? value as TravelDirection
    : null;
}

export function parseText(value: unknown, required = false) {
  const text = typeof value === "string" ? value.trim() : "";
  return required && !text ? null : text;
}

export function parseDateOnly(value: unknown) {
  return parseDate(value);
}

function dateKey(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export function isDateWithinTrip(date: Date | string, startDate: Date | string, endDate: Date | string) {
  const value = dateKey(date);
  return value >= dateKey(startDate) && value <= dateKey(endDate);
}

export function tripDateRangeError(startDate: Date | string, endDate: Date | string) {
  const format = (value: Date | string) => new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey(value)}T00:00:00.000Z`));

  return `Date must be between the trip start date (${format(startDate)}) and trip end date (${format(endDate)}).`;
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
