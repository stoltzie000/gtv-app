import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const migrationPath = new URL("../prisma/migrations/20260610220000_return_integrity_schedule_flags/migration.sql", import.meta.url);

describe("return-segment database integrity", () => {
  it("defines a one-to-one TravelSegment self-relation", async () => {
    const schema = await readFile(schemaPath, "utf8");
    expect(schema).toContain('@relation("TravelSegmentReturns", fields: [returnForSegmentId, tripId]');
    expect(schema).toContain("returnForSegmentId Int?           @unique");
  });

  it("migrates duplicate and invalid historical links before constraints", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toContain('SET "returnForSegmentId" = NULL');
    expect(migration).toContain("ROW_NUMBER() OVER");
  });

  it("enforces unique and foreign-key constraints", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toContain('CREATE UNIQUE INDEX "TravelSegment_returnForSegmentId_key"');
    expect(migration).toContain('ADD CONSTRAINT "TravelSegment_returnForSegmentId_fkey"');
    expect(migration).toContain('REFERENCES "TravelSegment"("id", "tripId")');
  });
});
