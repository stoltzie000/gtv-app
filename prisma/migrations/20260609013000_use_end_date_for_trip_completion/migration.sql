DROP INDEX IF EXISTS "Trip_completedAt_idx";
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "completedAt";
