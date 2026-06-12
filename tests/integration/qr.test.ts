import jsQR from "jsqr";
import { PNG } from "pngjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOwner, createTrip, resetDatabase } from "./helpers";

const state = vi.hoisted(() => ({ userId: 0, tripId: 0 }));
vi.mock("@/lib/trip-access", () => ({
  getOwnedTripId: vi.fn(async (tripId: number) => ({
    session: { userId: state.userId }, tripId: tripId === state.tripId ? tripId : null,
  })),
}));
import { GET as getQr } from "@/app/api/trips/[id]/qr/route";

beforeEach(async () => {
  await resetDatabase();
  const owner = await createOwner();
  const trip = await createTrip(owner.id, { shareToken: crypto.randomUUID() });
  state.userId = owner.id;
  state.tripId = trip.id;
});

async function decode(response: Response) {
  const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
}

describe("QR codes", () => {
  it("generates a scannable QR with the correct public URL and download headers", async () => {
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: state.tripId } });
    const response = await getQr(new Request(`http://localhost/api/trips/${trip.id}/qr?download=1`), { params: Promise.resolve({ id: String(trip.id) }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(await decode(response)).toBe(`http://localhost/share/${trip.shareToken}?source=qr`);
  });

  it("is stable on regeneration and unique across share tokens", async () => {
    const first = await getQr(new Request(`http://localhost/api/trips/${state.tripId}/qr`), { params: Promise.resolve({ id: String(state.tripId) }) });
    const firstUrl = await decode(first);
    const regenerated = await getQr(new Request(`http://localhost/api/trips/${state.tripId}/qr`), { params: Promise.resolve({ id: String(state.tripId) }) });
    expect(await decode(regenerated)).toBe(firstUrl);

    const owner = await createOwner();
    const other = await createTrip(owner.id, { shareToken: crypto.randomUUID() });
    state.userId = owner.id;
    state.tripId = other.id;
    const second = await getQr(new Request(`http://localhost/api/trips/${other.id}/qr`), { params: Promise.resolve({ id: String(other.id) }) });
    expect(await decode(second)).not.toBe(firstUrl);
  });
});
