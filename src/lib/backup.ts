import { gzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { daysAgo } from "@/lib/platform";

const BACKUP_PREFIX = "gtv-backups/";

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

async function snapshotDatabase() {
  const [
    users,
    trips,
    itineraryItems,
    travelSegments,
    documents,
    photos,
    updates,
    polls,
    pollOptions,
    pollVotes,
    deletionAudits,
    backupRuns,
  ] = await prisma.$transaction(async (tx) => Promise.all([
    tx.user.findMany(),
    tx.trip.findMany(),
    tx.itineraryItem.findMany(),
    tx.travelSegment.findMany(),
    tx.tripDocument.findMany(),
    tx.tripPhoto.findMany(),
    tx.tripUpdate.findMany(),
    tx.poll.findMany(),
    tx.pollOption.findMany(),
    tx.pollVote.findMany(),
    tx.accountDeletionAudit.findMany(),
    tx.backupRun.findMany(),
  ]), { isolationLevel: "RepeatableRead", timeout: 120_000 });

  return {
    format: "gtv-logical-backup-v1",
    createdAt: new Date().toISOString(),
    data: {
      users,
      trips,
      itineraryItems,
      travelSegments,
      documents,
      photos,
      updates,
      polls,
      pollOptions,
      pollVotes,
      deletionAudits,
      backupRuns,
    },
  };
}

function encodeBackup(snapshot: Awaited<ReturnType<typeof snapshotDatabase>>) {
  const json = JSON.stringify(snapshot, (_key, value) => {
    if (value instanceof Uint8Array) {
      return { $bytes: Buffer.from(value).toString("base64") };
    }
    return value;
  });
  return gzipSync(json, { level: 9 });
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

  try {
    const { client, bucket } = getStorage();
    const backup = encodeBackup(await snapshotDatabase());
    const date = new Date().toISOString().replace(/[:.]/g, "-");
    const objectKey = `${BACKUP_PREFIX}${date}-${randomUUID()}.json.gz`;

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: backup,
      ContentType: "application/gzip",
      ServerSideEncryption: "AES256",
    }));
    const expiredDeleted = await cleanExpiredBackups(client, bucket);

    await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        objectKey,
        size: backup.byteLength,
        completedAt: new Date(),
      },
    });
    return { status: "SUCCESS", objectKey, size: backup.byteLength, expiredDeleted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    await prisma.backupRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message.slice(0, 2000), completedAt: new Date() },
    });
    throw error;
  }
}
