import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, routeParams } from "./helpers";

const mocks = vi.hoisted(() => ({
  tripFindFirst: vi.fn(), pollFindFirst: vi.fn(), voteCreate: vi.fn(), voteFindUnique: vi.fn(),
  documentFindFirst: vi.fn(), photoFindFirst: vi.fn(), cookieGet: vi.fn(), cookieSet: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  trip: { findFirst: mocks.tripFindFirst },
  poll: { findFirst: mocks.pollFindFirst },
  pollVote: { create: mocks.voteCreate, findUnique: mocks.voteFindUnique },
  tripDocument: { findFirst: mocks.documentFindFirst },
  tripPhoto: { findFirst: mocks.photoFindFirst },
} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }) }));

import { getPublishedTrip } from "@/lib/public-trip";
import { POST as vote } from "@/app/api/public/[token]/vote/route";
import { GET as getMedia } from "@/app/api/public/[token]/media/[kind]/[mediaId]/route";

beforeEach(() => {
  mocks.cookieGet.mockReturnValue(undefined);
  mocks.voteCreate.mockResolvedValue({ id: 1 });
});

describe("public traveler access", () => {
  it("returns a published trip including updates and media metadata", async () => {
    mocks.tripFindFirst.mockResolvedValue({ id: 1, updates: [{ id: 2 }], documents: [{ id: 3 }], photos: [{ id: 4 }] });
    const trip = await getPublishedTrip("token");
    expect(trip).toMatchObject({ updates: [{ id: 2 }], documents: [{ id: 3 }], photos: [{ id: 4 }] });
    expect(mocks.tripFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { shareToken: "token", isPublished: true } }));
  });

  it("rejects an unpublished or invalid share token", async () => {
    mocks.tripFindFirst.mockResolvedValue(null);
    expect(await getPublishedTrip("invalid")).toBeNull();
  });

  it("records a poll vote for a published trip", async () => {
    mocks.pollFindFirst.mockResolvedValue({ id: 5 });
    const response = await vote(jsonRequest("http://test", { pollId: 5, optionId: 8 }), routeParams({ token: "token" }));
    expect(response.status).toBe(200);
    expect(mocks.voteCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ pollId: 5, optionId: 8 }) });
    expect(response.headers.get("set-cookie")).toContain("gtv_voter=");
  });

  it("rejects voting on closed or unpublished polls", async () => {
    mocks.pollFindFirst.mockResolvedValue(null);
    const response = await vote(jsonRequest("http://test", { pollId: 5, optionId: 8 }), routeParams({ token: "token" }));
    expect(response.status).toBe(404);
  });

  it.each([
    ["documents", mocks.documentFindFirst, "application/pdf"],
    ["photos", mocks.photoFindFirst, "image/png"],
  ])("serves published %s", async (kind, lookup, mimeType) => {
    lookup.mockResolvedValue({ name: `file.${kind === "documents" ? "pdf" : "png"}`, mimeType, size: 3, data: Uint8Array.from([1, 2, 3]) });
    const response = await getMedia(new Request("http://test"), routeParams({ token: "token", kind, mediaId: "3" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
