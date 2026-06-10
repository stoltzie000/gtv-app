import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitIdentity(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
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
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

export async function cleanExpiredRateLimits() {
  await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lte: new Date() } } });
}
