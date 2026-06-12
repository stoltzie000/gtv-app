import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tripFindMany: vi.fn(), userFindMany: vi.fn(), tripUpdateMany: vi.fn(), userUpdateMany: vi.fn(), tripDeleteMany: vi.fn(),
  auditCreate: vi.fn(), userDelete: vi.fn(), transaction: vi.fn(), sendEmail: vi.fn(), cleanExpired: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  trip: { findMany: mocks.tripFindMany, updateMany: mocks.tripUpdateMany, deleteMany: mocks.tripDeleteMany },
  user: { findMany: mocks.userFindMany, updateMany: mocks.userUpdateMany, delete: mocks.userDelete },
  accountDeletionAudit: { create: mocks.auditCreate }, $transaction: mocks.transaction,
} }));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/rate-limit", () => ({ cleanExpiredRateLimits: mocks.cleanExpired }));

import { runLifecycleJobs } from "@/lib/platform";

describe("draft lifecycle", () => {
  it("sends due draft reminders and deletes expired drafts", async () => {
    mocks.tripFindMany.mockResolvedValue([{ id: 1, tripName: "Draft", owner: { email: "user@example.com" } }]);
    mocks.userFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mocks.tripUpdateMany.mockResolvedValue({ count: 1 });
    mocks.tripDeleteMany.mockResolvedValue({ count: 2 });
    mocks.sendEmail.mockResolvedValue(undefined);
    const result = await runLifecycleJobs(new Date("2026-06-12T00:00:00.000Z"));
    expect(result.remindersDelivered).toBe(1);
    expect(result.tripsDeleted).toBe(2);
    expect(mocks.tripDeleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: expect.any(Array) } }));
  });
});
