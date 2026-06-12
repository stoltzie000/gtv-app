import { describe, expect, it } from "vitest";
import { readLimitedBody } from "@/lib/upload-body";

function streamedRequest(size: number, declaredLength?: number) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < size; offset += chunkSize) {
        controller.enqueue(new Uint8Array(Math.min(chunkSize, size - offset)));
      }
      controller.close();
    },
  });
  return new Request("http://localhost/upload", {
    method: "POST",
    headers: declaredLength === undefined ? undefined : { "content-length": String(declaredLength) },
    body,
    duplex: "half",
  } as RequestInit);
}

describe("upload request body limits", () => {
  const limit = 256 * 1024;

  it("accepts a streaming body just under the limit", async () => {
    expect((await readLimitedBody(streamedRequest(limit - 1), limit))?.byteLength).toBe(limit - 1);
  });

  it("accepts a streaming body exactly at the limit", async () => {
    expect((await readLimitedBody(streamedRequest(limit), limit))?.byteLength).toBe(limit);
  });

  it("cancels a streaming body above the limit", async () => {
    expect(await readLimitedBody(streamedRequest(limit + 1), limit)).toBeNull();
  });

  it("rejects an oversized declared length before reading", async () => {
    expect(await readLimitedBody(streamedRequest(1, limit + 1), limit)).toBeNull();
  });
});
