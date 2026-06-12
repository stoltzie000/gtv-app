import { prisma } from "@/lib/prisma";

export async function resetDatabase() {
  await prisma.rateLimitBucket.deleteMany();
  await prisma.backupRun.deleteMany();
  await prisma.accountDeletionAudit.deleteMany();
  await prisma.user.deleteMany();
}

export async function createOwner() {
  return prisma.user.create({ data: { email: `owner-${crypto.randomUUID()}@example.com`, password: "test" } });
}

export async function createTrip(ownerId: number, overrides: Record<string, unknown> = {}) {
  return prisma.trip.create({
    data: {
      tripName: "Alaska Test",
      tripType: "Cruise",
      startDate: new Date("2026-06-26T00:00:00.000Z"),
      endDate: new Date("2026-07-06T00:00:00.000Z"),
      travelerCount: 2,
      ownerId,
      ...overrides,
    },
  });
}

export function jsonRequest(urlOrMethod: string, body: unknown, method = "POST") {
  const isMethod = ["POST", "PATCH", "DELETE"].includes(urlOrMethod);
  return new Request(isMethod ? "http://localhost/api/test" : urlOrMethod, {
    method: isMethod ? urlOrMethod : method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function params(values: Record<string, string> | number) {
  return { params: Promise.resolve(typeof values === "number" ? { id: String(values) } : values) };
}
