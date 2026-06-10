import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { daysAgo } from "@/lib/platform";

const BACKUP_PREFIX = "gtv-backups/";
const BACKUP_PAGE_SIZE = 100;

function getStorage() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  const region = process.env.BACKUP_S3_REGION;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("Backup S3 storage is not configured");
  }

  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: process.env.BACKUP_S3_ENDPOINT || undefined,
      forcePathStyle: process.env.BACKUP_S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function serialize(value: unknown) {
  return JSON.stringify(value, (_key, nestedValue) => {
    if (nestedValue instanceof Uint8Array) {
      return { $bytes: Buffer.from(nestedValue).toString("base64") };
    }
    return nestedValue;
  });
}

async function writeChunk(stream: NodeJS.WritableStream, chunk: string) {
  if (!stream.write(chunk)) await once(stream, "drain");
}

async function writeTable<T extends { id: number }>(
  stream: NodeJS.WritableStream,
  name: string,
  loadPage: (cursor?: number) => Promise<T[]>,
  firstTable: boolean
) {
  await writeChunk(stream, `${firstTable ? "" : ","}${JSON.stringify(name)}:[`);
  let cursor: number | undefined;
  let firstRow = true;

  do {
    const rows = await loadPage(cursor);
    for (const row of rows) {
      await writeChunk(stream, `${firstRow ? "" : ","}${serialize(row)}`);
      firstRow = false;
    }
    cursor = rows.at(-1)?.id;
    if (rows.length < BACKUP_PAGE_SIZE) break;
  } while (cursor !== undefined);

  await writeChunk(stream, "]");
}

function page(cursor?: number) {
  return {
    take: BACKUP_PAGE_SIZE,
    orderBy: { id: "asc" as const },
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
  };
}

async function streamDatabaseBackup(filePath: string) {
  const gzip = createGzip({ level: 9 });
  const output = pipeline(gzip, createWriteStream(filePath));

  try {
    await prisma.$transaction(async (tx) => {
      await writeChunk(gzip, `{"format":"gtv-logical-backup-v1","createdAt":${JSON.stringify(new Date().toISOString())},"data":{`);
      await writeTable(gzip, "users", (cursor) => tx.user.findMany(page(cursor)), true);
      await writeTable(gzip, "trips", (cursor) => tx.trip.findMany(page(cursor)), false);
      await writeTable(gzip, "itineraryItems", (cursor) => tx.itineraryItem.findMany(page(cursor)), false);
      await writeTable(gzip, "travelSegments", (cursor) => tx.travelSegment.findMany(page(cursor)), false);
      await writeTable(gzip, "documents", (cursor) => tx.tripDocument.findMany(page(cursor)), false);
      await writeTable(gzip, "photos", (cursor) => tx.tripPhoto.findMany(page(cursor)), false);
      await writeTable(gzip, "updates", (cursor) => tx.tripUpdate.findMany(page(cursor)), false);
      await writeTable(gzip, "polls", (cursor) => tx.poll.findMany(page(cursor)), false);
      await writeTable(gzip, "pollOptions", (cursor) => tx.pollOption.findMany(page(cursor)), false);
      await writeTable(gzip, "pollVotes", (cursor) => tx.pollVote.findMany(page(cursor)), false);
      await writeTable(gzip, "deletionAudits", (cursor) => tx.accountDeletionAudit.findMany(page(cursor)), false);
      await writeTable(gzip, "backupRuns", (cursor) => tx.backupRun.findMany(page(cursor)), false);
      await writeTable(gzip, "rateLimitBuckets", (cursor) => tx.rateLimitBucket.findMany(page(cursor)), false);
      await writeChunk(gzip, "}}");
    }, { isolationLevel: "RepeatableRead", timeout: 600_000 });
    gzip.end();
    await output;
  } catch (error) {
    gzip.destroy(error instanceof Error ? error : new Error("Backup streaming failed"));
    await output.catch(() => undefined);
    throw error;
  }
}

async function cleanExpiredBackups(client: S3Client, bucket: string) {
  const cutoff = daysAgo(30);
  let continuationToken: string | undefined;
  let deleted = 0;

  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: BACKUP_PREFIX,
      ContinuationToken: continuationToken,
    }));
    const expired = (page.Contents ?? [])
      .filter((object) => object.Key && object.LastModified && object.LastModified < cutoff)
      .map((object) => ({ Key: object.Key! }));

    if (expired.length) {
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: expired, Quiet: true },
      }));
      deleted += expired.length;
    }
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);

  return deleted;
}

export async function runDailyBackup() {
  const run = await prisma.backupRun.create({ data: { status: "RUNNING" } });
  let tempDirectory: string | null = null;

  try {
    tempDirectory = await mkdtemp(join(tmpdir(), "gtv-backup-"));
    const backupPath = join(tempDirectory, "backup.json.gz");
    const { client, bucket } = getStorage();
    await streamDatabaseBackup(backupPath);
    const backupSize = (await stat(backupPath)).size;
    const date = new Date().toISOString().replace(/[:.]/g, "-");
    const objectKey = `${BACKUP_PREFIX}${date}-${randomUUID()}.json.gz`;

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: createReadStream(backupPath),
      ContentLength: backupSize,
      ContentType: "application/gzip",
      ServerSideEncryption: "AES256",
    }));
    const expiredDeleted = await cleanExpiredBackups(client, bucket);

    await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        objectKey,
        size: backupSize,
        completedAt: new Date(),
      },
    });
    return { status: "SUCCESS", objectKey, size: backupSize, expiredDeleted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    await prisma.backupRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message.slice(0, 2000), completedAt: new Date() },
    });
    throw error;
  } finally {
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  }
}
