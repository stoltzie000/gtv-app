ALTER TABLE "Trip" ALTER COLUMN "tripDirection" DROP DEFAULT;
ALTER TABLE "Trip" ALTER COLUMN "tripDirection" DROP NOT NULL;

-- Existing trip content remains untouched, but organizers must explicitly
-- choose a direction the next time they edit travel information.
UPDATE "Trip" SET "tripDirection" = NULL;

ALTER TABLE "TravelSegment"
ADD COLUMN "date" TIMESTAMP(3),
ADD COLUMN "time" TEXT,
ADD COLUMN "startLocation" TEXT NOT NULL DEFAULT '',
ADD COLUMN "destination" TEXT NOT NULL DEFAULT '';
