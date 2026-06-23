import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function normalizePostgresSslMode(connectionString: string) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

const connectionString = normalizePostgresSslMode(process.env.DATABASE_URL!);

const adapter = new PrismaPg({
  connectionString,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
