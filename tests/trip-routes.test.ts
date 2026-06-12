import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, routeParams } from "./helpers";

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  tripCreate: vi.fn(),
  tripUpdateMany: vi.fn(),
  tripFindFirstOrThrow: vi.fn(),
  tripDeleteMany: vi.fn(),
  userUpdate: vi.fn(),
  touchTrip: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ verifyToken: mocks.verifyToken }));
vi.mock("@/lib/platform", () => ({ touchTrip: mocks.touchTrip }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      create: mocks.tripCreate,
      updateMany: mocks.tripUpdateMany,
      findFirstOrThrow: mocks.tripFindFirstOrThrow,
      deleteMany: mocks.tripDeleteMany,
    },
    user: { update: mocks.userUpdate },
  },
}));

import { POST as createTrip } from "@/app/api/trips/route";
import { PATCH as updateTrip, DELETE as deleteTrip } from "@/app/api/trips/[id]/route";

const trip = {
  id: 7,
  tripName: "Alaska",
  tripType: "Cruise",
  startDate: new Date("2026-06-26T00:00:00.000Z"),
  endDate: new Date("2026-07-06T00:00:00.000Z"),
  travelerCount: 2,
  isPublished: false,
};

beforeEach(() => {
  mocks.verifyToken.mockResolvedValue({ userId: 1, email: "user@example.com" });
  mocks.userUpdate.mockResolvedValue({});
  mocks.touchTrip.mockResolvedValue(undefined);
});

describe("trip lifecycle routes", () => {
  it("creates a trip", async () => {
    mocks.tripCreate.mockResolvedValue(trip);
    const response = await createTrip(jsonRequest("http://test/api/trips", {
      tripName: "Alaska", tripType: "Cruise", startDate: "2026-06-26", endDate: "2026-07-06", travelerCount: 2,
    }));
    expect(response.status).toBe(201);
    expect(mocks.tripCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: 1 }) }));
  });

  it("rejects an invalid trip range", async () => {
    const response = await createTrip(jsonRequest("http://test/api/trips", {
      tripName: "Alaska", tripType: "Cruise", startDate: "2026-07-06", endDate: "2026-06-26", travelerCount: 2,
    }));
    expect(response.status).toBe(400);
  });

  it("edits a trip", async () => {
    mocks.tripUpdateMany.mockResolvedValue({ count: 1 });
    mocks.tripFindFirstOrThrow.mockResolvedValue({ ...trip, tripName: "Updated" });
    const response = await updateTrip(jsonRequest("http://test/api/trips/7", {
      tripName: "Updated", tripType: "Cruise", startDate: "2026-06-26", endDate: "2026-07-06", travelerCount: 3,
    }, "PATCH"), routeParams({ id: "7" }));
    expect(response.status).toBe(200);
    expect(mocks.touchTrip).toHaveBeenCalledWith(7, 1);
  });

  it.each([true, false])("sets publication state to %s", async (isPublished) => {
    mocks.tripUpdateMany.mockResolvedValue({ count: 1 });
    mocks.tripFindFirstOrThrow.mockResolvedValue({ ...trip, isPublished });
    const response = await updateTrip(jsonRequest("http://test/api/trips/7", { isPublished }, "PATCH"), routeParams({ id: "7" }));
    expect(response.status).toBe(200);
    expect(mocks.tripUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isPublished }) }));
  });

  it("deletes an owned trip", async () => {
    mocks.tripDeleteMany.mockResolvedValue({ count: 1 });
    const response = await deleteTrip(new Request("http://test/api/trips/7", { method: "DELETE" }), routeParams({ id: "7" }));
    expect(response.status).toBe(204);
  });

  it("does not delete another owner's trip", async () => {
    mocks.tripDeleteMany.mockResolvedValue({ count: 0 });
    const response = await deleteTrip(new Request("http://test/api/trips/7", { method: "DELETE" }), routeParams({ id: "7" }));
    expect(response.status).toBe(404);
  });
});
