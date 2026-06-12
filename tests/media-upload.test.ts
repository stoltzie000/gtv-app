import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeParams } from "./helpers";

const mocks = vi.hoisted(() => ({
  getOwnedTripId: vi.fn(), transaction: vi.fn(), documentAggregate: vi.fn(), photoAggregate: vi.fn(), documentCreate: vi.fn(), photoCreate: vi.fn(),
}));

const tx = {
  tripDocument: { aggregate: mocks.documentAggregate, create: mocks.documentCreate },
  tripPhoto: { aggregate: mocks.photoAggregate, create: mocks.photoCreate },
};

vi.mock("@/lib/trip-access", () => ({ getOwnedTripId: mocks.getOwnedTripId }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  tripDocument: { aggregate: mocks.documentAggregate, create: mocks.documentCreate },
  tripPhoto: { aggregate: mocks.photoAggregate, create: mocks.photoCreate },
  $transaction: mocks.transaction,
} }));

import { POST } from "@/app/api/trips/[id]/media/[kind]/route";
import { UPLOAD_REQUEST_SIZE_LIMIT } from "@/lib/platform";

function uploadRequest(bytes: number[], name: string, declaredType: string) {
  const form = new FormData();
  form.set("file", new File([Uint8Array.from(bytes)], name, { type: declaredType }));
  return new Request("http://test/upload", { method: "POST", body: form });
}

beforeEach(() => {
  mocks.getOwnedTripId.mockResolvedValue({ session: { userId: 1 }, tripId: 7 });
  mocks.documentAggregate.mockResolvedValue({ _count: 0, _sum: { size: 0 } });
  mocks.photoAggregate.mockResolvedValue({ _count: 0, _sum: { size: 0 } });
  mocks.documentCreate.mockResolvedValue({ id: 1, name: "file.pdf", size: 5 });
  mocks.photoCreate.mockResolvedValue({ id: 2, name: "file.png", size: 8 });
  mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
});

describe("media uploads", () => {
  it("accepts a valid PDF despite an incorrect declared MIME type", async () => {
    const response = await POST(uploadRequest([0x25, 0x50, 0x44, 0x46, 0x2d], "file.pdf", "text/plain"), routeParams({ id: "7", kind: "documents" }));
    expect(response.status).toBe(201);
    expect(mocks.documentCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mimeType: "application/pdf" }) }));
  });

  it("rejects a disguised PDF", async () => {
    const response = await POST(uploadRequest([...new TextEncoder().encode("not pdf")], "file.pdf", "application/pdf"), routeParams({ id: "7", kind: "documents" }));
    expect(response.status).toBe(400);
  });

  it("accepts a valid image", async () => {
    const response = await POST(uploadRequest([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "file.png", "application/octet-stream"), routeParams({ id: "7", kind: "photos" }));
    expect(response.status).toBe(201);
    expect(mocks.photoCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mimeType: "image/png" }) }));
  });

  it("rejects a disguised image", async () => {
    const response = await POST(uploadRequest([...new TextEncoder().encode("not image")], "file.png", "image/png"), routeParams({ id: "7", kind: "photos" }));
    expect(response.status).toBe(400);
  });

  it("rejects oversized requests before multipart parsing", async () => {
    const response = await POST(new Request("http://test/upload", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=x", "Content-Length": String(UPLOAD_REQUEST_SIZE_LIMIT + 1) },
      body: "x",
    }), routeParams({ id: "7", kind: "photos" }));
    expect(response.status).toBe(413);
  });
});
