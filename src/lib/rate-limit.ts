import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

let rateLimitTableReady: Promise<void> | null = null;

function ensureRateLimitTable() {
  rateLimitTableReady ??= prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
      "id" SERIAL NOT NULL,
      "key" TEXT NOT NULL,
      "count" INTEGER NOT NULL,
      "resetAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
    )
  `.then(async () => {
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "RateLimitBucket_key_key" ON "RateLimitBucket"("key")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt")`;
  });
  return rateLimitTableReady;
}

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitIdentity(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  await ensureRateLimitTable();
  const now = Date.now();
  const resetAt = new Date(now + windowMs);
  const [entry] = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."resetAt"
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING "count", "resetAt"
  `;
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt.getTime() - now) / 1000));
  return { allowed: entry.count <= limit, retryAfter };
}

export async function clearRateLimit(key: string) {
  await ensureRateLimitTable();
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

export async function cleanExpiredRateLimits() {
  await ensureRateLimitTable();
  await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lte: new Date() } } });
}
