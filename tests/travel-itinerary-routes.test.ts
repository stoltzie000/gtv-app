import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, responseJson, routeParams } from "./helpers";

const mocks = vi.hoisted(() => ({
  getOwnedTripId: vi.fn(),
  tripFindUnique: vi.fn(),
  itineraryCreate: vi.fn(), itineraryUpdateMany: vi.fn(), itineraryDeleteMany: vi.fn(), itineraryCount: vi.fn(), itineraryCreateMany: vi.fn(),
  segmentCreate: vi.fn(), segmentFindFirst: vi.fn(), segmentFindMany: vi.fn(), segmentUpdate: vi.fn(), segmentUpdateMany: vi.fn(), segmentDeleteMany: vi.fn(), segmentAggregate: vi.fn(),
  transaction: vi.fn(),
}));

const tx = {
  trip: { findUnique: mocks.tripFindUnique },
  itineraryItem: { create: mocks.itineraryCreate, updateMany: mocks.itineraryUpdateMany, deleteMany: mocks.itineraryDeleteMany, createMany: mocks.itineraryCreateMany },
  travelSegment: {
    create: mocks.segmentCreate, findFirst: mocks.segmentFindFirst, findMany: mocks.segmentFindMany,
    update: mocks.segmentUpdate, updateMany: mocks.segmentUpdateMany, deleteMany: mocks.segmentDeleteMany, aggregate: mocks.segmentAggregate,
  },
};

vi.mock("@/lib/trip-access", () => ({ getOwnedTripId: mocks.getOwnedTripId }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  trip: { findUnique: mocks.tripFindUnique },
  itineraryItem: { create: mocks.itineraryCreate, updateMany: mocks.itineraryUpdateMany, deleteMany: mocks.itineraryDeleteMany, count: mocks.itineraryCount },
  travelSegment: {
    create: mocks.segmentCreate, findFirst: mocks.segmentFindFirst, findMany: mocks.segmentFindMany,
    update: mocks.segmentUpdate, updateMany: mocks.segmentUpdateMany, deleteMany: mocks.segmentDeleteMany, aggregate: mocks.segmentAggregate,
  },
  $transaction: mocks.transaction,
} }));

import { POST, PATCH, DELETE } from "@/app/api/trips/[id]/sections/route";

const context = routeParams({ id: "7" });
const range = { startDate: new Date("2026-06-26T00:00:00.000Z"), endDate: new Date("2026-07-06T00:00:00.000Z") };

beforeEach(() => {
  mocks.getOwnedTripId.mockResolvedValue({ session: { userId: 1 }, tripId: 7 });
  mocks.tripFindUnique.mockResolvedValue(range);
  mocks.transaction.mockImplementation(async (value: unknown) => typeof value === "function" ? value(tx) : value);
  mocks.segmentAggregate.mockResolvedValue({ _max: { position: 0 } });
  mocks.itineraryUpdateMany.mockResolvedValue({ count: 1 });
  mocks.segmentUpdateMany.mockResolvedValue({ count: 1 });
  mocks.itineraryDeleteMany.mockResolvedValue({ count: 1 });
  mocks.segmentDeleteMany.mockResolvedValue({ count: 1 });
});

describe("itinerary routes", () => {
  it("creates an itinerary item", async () => {
    mocks.itineraryCreate.mockResolvedValue({ id: 1 });
    const response = await POST(jsonRequest("http://test", { action: "itinerary", date: "2026-06-26", time: "09:00", title: "Board ship", description: "" }), context);
    expect(response.status).toBe(201);
  });

  it("edits an itinerary item", async () => {
    const response = await PATCH(jsonRequest("http://test", { action: "itinerary", itemId: 1, date: "2026-07-06", time: "09:00", title: "Home", description: "" }, "PATCH"), context);
    expect(response.status).toBe(200);
    expect(mocks.itineraryUpdateMany).toHaveBeenCalled();
  });

  it("deletes an itinerary item", async () => {
    const response = await DELETE(jsonRequest("http://test", { action: "itinerary", itemId: 1 }, "DELETE"), context);
    expect(response.status).toBe(204);
  });

  it("rejects itinerary dates outside the trip", async () => {
    const response = await POST(jsonRequest("http://test", { action: "itinerary", date: "2026-07-07", time: "09:00", title: "Late", description: "" }), context);
    expect(response.status).toBe(400);
    expect(await responseJson(response)).toMatchObject({ error: expect.stringContaining("Date must be between") });
  });

  it("populates itinerary items from travel", async () => {
    mocks.segmentFindMany.mockResolvedValue([{ id: 1, type: "Flight", title: "Outbound", description: "", date: range.startDate, time: "08:00", startLocation: "SRQ", destination: "SEA", returnForSegmentId: null }]);
    mocks.itineraryCount.mockResolvedValue(0);
    mocks.itineraryCreateMany.mockResolvedValue({ count: 1 });
    const response = await PATCH(jsonRequest("http://test", { action: "populateItinerary", mode: "add", confirm: false }, "PATCH"), context);
    expect(response.status).toBe(200);
    expect(mocks.itineraryCreateMany).toHaveBeenCalled();
  });
});

describe("travel segment routes", () => {
  const segment = { action: "segment", type: "Flight", title: "Outbound", description: "", date: "2026-06-26", time: "08:00", startLocation: "SRQ", destination: "SEA" };

  it("creates a one-way segment", async () => {
    mocks.segmentCreate.mockResolvedValue({ id: 1, position: 1 });
    const response = await POST(jsonRequest("http://test", { ...segment, direction: "ONE_WAY" }), context);
    expect(response.status).toBe(201);
    expect(mocks.segmentCreate).toHaveBeenCalledTimes(1);
  });

  it("creates a round trip and generated return", async () => {
    mocks.segmentCreate.mockResolvedValueOnce({ id: 1, position: 1 }).mockResolvedValueOnce({ id: 2, position: 2 });
    const response = await POST(jsonRequest("http://test", { ...segment, direction: "ROUND_TRIP" }), context);
    expect(response.status).toBe(201);
    expect(mocks.segmentCreate).toHaveBeenCalledTimes(2);
    expect(mocks.segmentCreate).toHaveBeenLastCalledWith({ data: expect.objectContaining({ returnForSegmentId: 1, autoGenerated: true }) });
  });

  it("edits a segment", async () => {
    mocks.segmentFindFirst.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
    mocks.segmentUpdate.mockResolvedValue({ id: 1 });
    mocks.segmentCreate.mockResolvedValue({ id: 2 });
    const response = await PATCH(jsonRequest("http://test", { ...segment, itemId: 1, direction: "ROUND_TRIP" }, "PATCH"), context);
    expect(response.status).toBe(200);
    expect(mocks.segmentUpdate).toHaveBeenCalled();
  });

  it("deletes a segment", async () => {
    mocks.segmentFindFirst.mockResolvedValue({ returnForSegmentId: null });
    mocks.segmentFindMany.mockResolvedValue([]);
    const response = await DELETE(jsonRequest("http://test", { action: "segment", itemId: 1 }, "DELETE"), context);
    expect(response.status).toBe(204);
  });

  it("rejects travel dates outside the trip", async () => {
    const response = await POST(jsonRequest("http://test", { ...segment, date: "2026-06-25", direction: "ONE_WAY" }), context);
    expect(response.status).toBe(400);
  });
});
