import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, routeParams } from "./helpers";

const mocks = vi.hoisted(() => ({
  getOwnedTripId: vi.fn(), transaction: vi.fn(),
  queryRaw: vi.fn(),
  segmentFindFirst: vi.fn(), segmentUpdate: vi.fn(),
  itineraryFindFirst: vi.fn(), itineraryUpdateMany: vi.fn(),
  tripFindUnique: vi.fn(), updateCreate: vi.fn(), updateFindFirst: vi.fn(), updateFindMany: vi.fn(), updateUpdate: vi.fn(), updateDelete: vi.fn(),
}));

const tx = {
  $queryRaw: mocks.queryRaw,
  travelSegment: { findFirst: mocks.segmentFindFirst, update: mocks.segmentUpdate },
  itineraryItem: { findFirst: mocks.itineraryFindFirst, updateMany: mocks.itineraryUpdateMany },
  trip: { findUnique: mocks.tripFindUnique },
  tripUpdate: { create: mocks.updateCreate, findFirst: mocks.updateFindFirst, findMany: mocks.updateFindMany, update: mocks.updateUpdate, delete: mocks.updateDelete },
};

vi.mock("@/lib/trip-access", () => ({ getOwnedTripId: mocks.getOwnedTripId }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  travelSegment: { findFirst: mocks.segmentFindFirst },
  itineraryItem: { findFirst: mocks.itineraryFindFirst },
  trip: { findUnique: mocks.tripFindUnique },
  tripUpdate: { findFirst: mocks.updateFindFirst },
  $transaction: mocks.transaction,
} }));

import { POST, PATCH, DELETE } from "@/app/api/trips/[id]/community/route";

const context = routeParams({ id: "7" });
const originalDate = new Date("2026-06-26T00:00:00.000Z");
const changedDate = new Date("2026-06-27T00:00:00.000Z");

beforeEach(() => {
  mocks.getOwnedTripId.mockResolvedValue({ session: { userId: 1 }, tripId: 7 });
  mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  mocks.tripFindUnique.mockResolvedValue({ startDate: originalDate, endDate: new Date("2026-07-06T00:00:00.000Z") });
  mocks.segmentUpdate.mockResolvedValue({});
  mocks.itineraryUpdateMany.mockResolvedValue({ count: 1 });
  mocks.updateUpdate.mockResolvedValue({});
  mocks.updateDelete.mockResolvedValue({});
});

describe("updates API", () => {
  it("creates a general update", async () => {
    mocks.updateCreate.mockResolvedValue({ id: 1, updateKind: "INFORMATIONAL" });
    const response = await POST(jsonRequest("http://test", { action: "update", updateType: "GENERAL", updateKind: "INFORMATIONAL", title: "Notice", content: "Meet in lobby" }), context);
    expect(response.status).toBe(201);
    expect(mocks.updateCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ updateType: "GENERAL" }) });
  });

  it("creates a travel schedule change and propagates it to itinerary", async () => {
    const created = { id: 1, createdAt: new Date(), updateKind: "SCHEDULE_CHANGE", newDate: changedDate, newTime: "10:00", changesDate: true, changesTime: true, originalDate, originalTime: "09:00" };
    mocks.segmentFindFirst.mockResolvedValue({ id: 3, date: originalDate, time: "09:00", returnForSegmentId: null });
    mocks.updateCreate.mockResolvedValue(created);
    mocks.updateFindMany.mockResolvedValue([created]);
    const response = await POST(jsonRequest("http://test", { action: "update", updateType: "TRAVEL", updateKind: "SCHEDULE_CHANGE", travelSegmentId: 3, title: "Changed", content: "New departure", newDate: "2026-06-27", newTime: "10:00" }), context);
    expect(response.status).toBe(201);
    expect(mocks.segmentUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { date: changedDate, time: "10:00" } }));
    expect(mocks.itineraryUpdateMany).toHaveBeenCalled();
  });

  it("edits a schedule update and permits clearing one changed field", async () => {
    const existing = { id: 1, createdAt: new Date(), updateType: "ITINERARY", updateKind: "SCHEDULE_CHANGE", itineraryItemId: 4, travelSegmentId: null, originalDate, originalTime: "09:00" };
    const replay = { ...existing, newDate: originalDate, newTime: "11:00", changesDate: false, changesTime: true };
    mocks.itineraryFindFirst.mockResolvedValue({ id: 4, date: originalDate, time: "11:00" });
    mocks.updateFindFirst.mockResolvedValue(existing);
    mocks.updateFindMany.mockResolvedValue([replay]);
    const response = await PATCH(jsonRequest("http://test", { action: "update", updateId: 1, updateType: "ITINERARY", updateKind: "SCHEDULE_CHANGE", itineraryItemId: 4, title: "Changed", content: "Time only", newDate: "", newTime: "11:00" }, "PATCH"), context);
    expect(response.status).toBe(200);
    expect(mocks.updateUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ changesDate: false, changesTime: true }) }));
  });

  it("deletes a schedule update and reapplies the original schedule", async () => {
    const existing = { id: 1, createdAt: new Date(), updateType: "TRAVEL", updateKind: "SCHEDULE_CHANGE", travelSegmentId: 3, sourceTravelSegmentId: 3, itineraryItemId: null, originalDate, originalTime: "09:00" };
    mocks.updateFindFirst.mockResolvedValue(existing);
    mocks.updateFindMany.mockResolvedValueOnce([existing]).mockResolvedValueOnce([]);
    mocks.segmentFindFirst.mockResolvedValue({ id: 3, date: changedDate, time: "10:00", returnForSegmentId: null });
    const response = await DELETE(jsonRequest("http://test", { updateId: 1 }, "DELETE"), context);
    expect(response.status).toBe(204);
    expect(mocks.segmentUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { date: originalDate, time: "09:00" } }));
  });

  it("rejects schedule dates outside the trip", async () => {
    mocks.segmentFindFirst.mockResolvedValue({ id: 3 });
    const response = await POST(jsonRequest("http://test", { action: "update", updateType: "TRAVEL", updateKind: "SCHEDULE_CHANGE", travelSegmentId: 3, title: "Changed", content: "Too late", newDate: "2026-07-07" }), context);
    expect(response.status).toBe(400);
  });
});
