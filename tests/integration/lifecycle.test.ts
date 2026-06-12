import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOwner, createTrip, resetDatabase } from "./helpers";

const sendEmail = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/rate-limit", () => ({ cleanExpiredRateLimits: vi.fn(async () => 0) }));
import { runLifecycleJobs, touchTrip } from "@/lib/platform";

beforeEach(async () => {
  await resetDatabase();
  sendEmail.mockClear();
});

describe("account and trip inactivity lifecycle", () => {
  const now = new Date("2026-06-12T12:00:00Z");

  it("warns inactive accounts and suppresses future warning after login activity", async () => {
    const owner = await prisma.user.create({ data: { email: "warning@example.com", password: "x", lastActivityAt: new Date("2025-07-01T00:00:00Z") } });
    const trip = await createTrip(owner.id, { lastActivityAt: new Date("2026-06-01T00:00:00Z") });
    const first = await runLifecycleJobs(now);
    expect(first.accountWarningsDelivered).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).inactivityWarningAt).toEqual(now);

    await touchTrip(trip.id, owner.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).inactivityWarningAt).toBeNull();
    const second = await runLifecycleJobs(now);
    expect(second.accountWarningsDelivered).toBe(0);
  });

  it("deletes expired drafts, completed trips, and warned inactive accounts", async () => {
    const active = await createOwner();
    await createTrip(active.id, { tripName: "Old draft", isPublished: false, lastActivityAt: new Date("2026-05-01T00:00:00Z") });
    await createTrip(active.id, { tripName: "Completed", isPublished: true, endDate: new Date("2026-05-01T00:00:00Z") });
    const inactive = await prisma.user.create({ data: {
      email: "delete@example.com", password: "x", lastActivityAt: new Date("2025-05-01T00:00:00Z"), inactivityWarningAt: new Date("2026-05-01T00:00:00Z"),
    } });

    const result = await runLifecycleJobs(now);
    expect(result.tripsDeleted).toBe(2);
    expect(result.accountsDeleted).toBe(1);
    expect(await prisma.trip.count({ where: { ownerId: active.id } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: inactive.id } })).toBeNull();
    expect(await prisma.accountDeletionAudit.findFirst({ where: { userId: inactive.id, reason: "INACTIVITY_1_YEAR" } })).not.toBeNull();
  });
});
