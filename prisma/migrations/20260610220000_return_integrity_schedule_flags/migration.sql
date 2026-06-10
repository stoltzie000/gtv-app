-- Detach invalid historical return links before adding constraints. Existing
-- valid links are preserved, and the lowest-id return wins any duplicate set.
UPDATE "TravelSegment" return_segment
SET "returnForSegmentId" = NULL
WHERE return_segment."returnForSegmentId" IS NOT NULL
  AND (
    return_segment.id = return_segment."returnForSegmentId"
    OR NOT EXISTS (
      SELECT 1
      FROM "TravelSegment" outbound
      WHERE outbound.id = return_segment."returnForSegmentId"
        AND outbound."tripId" = return_segment."tripId"
    )
  );

WITH duplicate_returns AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "returnForSegmentId"
    ORDER BY id
  ) AS row_number
  FROM "TravelSegment"
  WHERE "returnForSegmentId" IS NOT NULL
)
UPDATE "TravelSegment" segment
SET "returnForSegmentId" = NULL
FROM duplicate_returns duplicate
WHERE segment.id = duplicate.id
  AND duplicate.row_number > 1;

DROP INDEX IF EXISTS "TravelSegment_returnForSegmentId_idx";
CREATE UNIQUE INDEX "TravelSegment_returnForSegmentId_key"
ON "TravelSegment"("returnForSegmentId");

CREATE UNIQUE INDEX "TravelSegment_id_tripId_key"
ON "TravelSegment"("id", "tripId");

CREATE UNIQUE INDEX "TravelSegment_returnForSegmentId_tripId_key"
ON "TravelSegment"("returnForSegmentId", "tripId");

ALTER TABLE "TravelSegment"
ADD CONSTRAINT "TravelSegment_returnForSegmentId_fkey"
FOREIGN KEY ("returnForSegmentId", "tripId") REFERENCES "TravelSegment"("id", "tripId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TripUpdate"
ADD COLUMN "changesDate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "changesTime" BOOLEAN NOT NULL DEFAULT false;

UPDATE "TripUpdate"
SET
  "changesDate" = "newDate" IS DISTINCT FROM "originalDate",
  "changesTime" = "newTime" IS DISTINCT FROM "originalTime"
WHERE "updateKind" = 'SCHEDULE_CHANGE';
