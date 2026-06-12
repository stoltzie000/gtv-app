import { describe, expect, it } from "vitest";
import { detectUploadType } from "@/lib/file-validation";
import { applyScheduleFields } from "@/lib/schedule";
import { deriveTripSummary } from "@/lib/trip-summary";
import { isDateWithinTrip, parseTripInput, tripDateRangeError } from "@/lib/trips";

describe("trip validation", () => {
  const start = "2026-06-26";
  const end = "2026-07-06";

  it("accepts the first and last trip days", () => {
    expect(isDateWithinTrip(start, start, end)).toBe(true);
    expect(isDateWithinTrip(end, start, end)).toBe(true);
  });

  it("rejects dates before and after the trip", () => {
    expect(isDateWithinTrip("2026-06-25", start, end)).toBe(false);
    expect(isDateWithinTrip("2026-07-07", start, end)).toBe(false);
  });

  it("returns the traveler-facing range error", () => {
    expect(tripDateRangeError(start, end)).toBe(
      "Date must be between the trip start date (Jun 26, 2026) and trip end date (Jul 6, 2026)."
    );
  });

  it("parses valid trips and rejects reversed dates", () => {
    expect(parseTripInput({ tripName: "Cruise", tripType: "Cruise", startDate: start, endDate: end, travelerCount: 2 })).not.toBeNull();
    expect(parseTripInput({ tripName: "Cruise", tripType: "Cruise", startDate: end, endDate: start, travelerCount: 2 })).toBeNull();
  });
});

describe("schedule replay", () => {
  const original = { date: new Date("2026-06-26T00:00:00.000Z"), time: "09:00" };

  it("changes date without changing time", () => {
    expect(applyScheduleFields(original, { date: new Date("2026-06-27T00:00:00.000Z"), time: null, changesDate: true, changesTime: false })).toEqual({
      date: new Date("2026-06-27T00:00:00.000Z"), time: "09:00",
    });
  });

  it("changes time without changing date", () => {
    expect(applyScheduleFields(original, { date: null, time: "12:00", changesDate: false, changesTime: true })).toEqual({
      date: original.date, time: "12:00",
    });
  });

  it("replays sequential changes after an earlier date change is cleared", () => {
    const restored = applyScheduleFields(original, { date: null, time: null, changesDate: false, changesTime: false });
    const replayed = applyScheduleFields(restored, { date: null, time: "12:00", changesDate: false, changesTime: true });
    expect(replayed).toEqual({ date: original.date, time: "12:00" });
  });
});

describe("media signatures", () => {
  it.each([
    ["PDF", [0x25, 0x50, 0x44, 0x46, 0x2d], "application/pdf"],
    ["JPEG", [0xff, 0xd8, 0xff], "image/jpeg"],
    ["PNG", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"],
    ["GIF", [...new TextEncoder().encode("GIF89a")], "image/gif"],
    ["WebP", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "image/webp"],
  ])("detects %s files", (_name, bytes, expected) => {
    expect(detectUploadType(Uint8Array.from(bytes as number[]))).toBe(expected);
  });

  it("rejects disguised files", () => {
    expect(detectUploadType(new TextEncoder().encode("not really a PDF"))).toBeNull();
  });
});

describe("trip summary", () => {
  it("prioritizes travel and significant itinerary milestones", () => {
    expect(deriveTripSummary({
      startDate: "2026-06-26",
      endDate: "2026-06-30",
      destination: "Seattle",
      startLocation: "SRQ",
      travelSegments: [{ date: "2026-06-26", type: "Flight", title: "Outbound", destination: "Seattle" }],
      itineraryItems: [{ date: "2026-06-27", title: "Space Needle" }],
    })).toEqual([
      { date: "2026-06-26", title: "Flight to Seattle" },
      { date: "2026-06-27", title: "Space Needle" },
    ]);
  });
});
