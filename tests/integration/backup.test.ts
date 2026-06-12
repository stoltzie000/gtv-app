import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import S3rver from "s3rver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runDailyBackup } from "@/lib/backup";
import { createOwner, createTrip, resetDatabase } from "./helpers";

const port = 45691;
const bucket = "gtv-test-backups";
let directory = "";
let server: S3rver;

function decodeChunked(value: Buffer) {
  if (value[0] === 0x1f && value[1] === 0x8b) return value;
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < value.length) {
    const lineEnd = value.indexOf("\r\n", offset);
    const size = Number.parseInt(value.subarray(offset, lineEnd).toString("ascii").split(";")[0], 16);
    if (!Number.isFinite(size) || size === 0) break;
    offset = lineEnd + 2;
    chunks.push(value.subarray(offset, offset + size));
    offset += size + 2;
  }
  return Buffer.concat(chunks);
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "gtv-s3-"));
  server = new S3rver({ address: "127.0.0.1", port, directory, silent: true, resetOnClose: true, configureBuckets: [{ name: bucket }] });
  await server.run();
  Object.assign(process.env, {
    BACKUP_S3_BUCKET: bucket,
    BACKUP_S3_REGION: "us-east-1",
    BACKUP_S3_ACCESS_KEY_ID: "S3RVER",
    BACKUP_S3_SECRET_ACCESS_KEY: "S3RVER",
    BACKUP_S3_ENDPOINT: `http://127.0.0.1:${port}`,
    BACKUP_S3_FORCE_PATH_STYLE: "true",
  });
});

afterAll(async () => {
  await server.close();
  await rm(directory, { recursive: true, force: true });
});

beforeEach(resetDatabase);

describe("real streaming backup", () => {
  it("writes a valid gzip archive to temporary S3 storage and reads it back", async () => {
    const owner = await createOwner();
    const trip = await createTrip(owner.id);
    const result = await runDailyBackup();
    expect(result.status).toBe("SUCCESS");
    expect(result.size).toBeGreaterThan(0);

    const client = new S3Client({
      region: "us-east-1", endpoint: `http://127.0.0.1:${port}`, forcePathStyle: true,
      credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" },
    });
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: result.objectKey }));
    const compressed = decodeChunked(Buffer.from(await object.Body!.transformToByteArray()));
    expect(compressed.subarray(0, 3).toString("hex")).toBe("1f8b08");
    const archive = JSON.parse(gunzipSync(compressed).toString("utf8"));
    expect(archive.format).toBe("gtv-logical-backup-v1");
    expect(archive.data.users.some((item: { id: number }) => item.id === owner.id)).toBe(true);
    expect(archive.data.trips.some((item: { id: number }) => item.id === trip.id)).toBe(true);
    expect((await prisma.backupRun.findFirstOrThrow()).status).toBe("SUCCESS");
  });
});
