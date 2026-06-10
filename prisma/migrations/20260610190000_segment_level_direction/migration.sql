ALTER TABLE "TravelSegment"
ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'ONE_WAY',
ADD COLUMN "returnForSegmentId" INTEGER;

-- Pair only unambiguous reverse-route records from trips previously marked
-- round trip. Ambiguous or manually constructed segments remain one-way.
WITH candidate_pairs AS (
  SELECT
    outbound.id AS "outboundId",
    return_segment.id AS "returnId",
    COUNT(*) OVER (PARTITION BY outbound.id) AS "outboundMatches",
    COUNT(*) OVER (PARTITION BY return_segment.id) AS "returnMatches"
  FROM "TravelSegment" outbound
  JOIN "Trip" trip ON trip.id = outbound."tripId"
  JOIN "TravelSegment" return_segment
    ON return_segment."tripId" = outbound."tripId"
    AND return_segment.journey = 'RETURN'
    AND return_segment.type = outbound.type
    AND LOWER(TRIM(return_segment."startLocation")) = LOWER(TRIM(outbound.destination))
    AND LOWER(TRIM(return_segment.destination)) = LOWER(TRIM(outbound."startLocation"))
  WHERE trip."tripDirection" = 'ROUND_TRIP'
    AND outbound.journey = 'OUTBOUND'
), unique_pairs AS (
  SELECT "outboundId", "returnId"
  FROM candidate_pairs
  WHERE "outboundMatches" = 1 AND "returnMatches" = 1
)
UPDATE "TravelSegment" segment
SET direction = 'ROUND_TRIP'
FROM unique_pairs
WHERE segment.id = unique_pairs."outboundId";

WITH candidate_pairs AS (
  SELECT
    outbound.id AS "outboundId",
    return_segment.id AS "returnId",
    COUNT(*) OVER (PARTITION BY outbound.id) AS "outboundMatches",
    COUNT(*) OVER (PARTITION BY return_segment.id) AS "returnMatches"
  FROM "TravelSegment" outbound
  JOIN "Trip" trip ON trip.id = outbound."tripId"
  JOIN "TravelSegment" return_segment
    ON return_segment."tripId" = outbound."tripId"
    AND return_segment.journey = 'RETURN'
    AND return_segment.type = outbound.type
    AND LOWER(TRIM(return_segment."startLocation")) = LOWER(TRIM(outbound.destination))
    AND LOWER(TRIM(return_segment.destination)) = LOWER(TRIM(outbound."startLocation"))
  WHERE trip."tripDirection" = 'ROUND_TRIP'
    AND outbound.journey = 'OUTBOUND'
), unique_pairs AS (
  SELECT "outboundId", "returnId"
  FROM candidate_pairs
  WHERE "outboundMatches" = 1 AND "returnMatches" = 1
)
UPDATE "TravelSegment" segment
SET "returnForSegmentId" = unique_pairs."outboundId"
FROM unique_pairs
WHERE segment.id = unique_pairs."returnId";

-- Rebuild a single stable display order now that outbound and return are no
-- longer separate trip-wide groups.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "tripId"
    ORDER BY date NULLS LAST, time NULLS LAST, "createdAt", id
  ) - 1 AS position
  FROM "TravelSegment"
)
UPDATE "TravelSegment" segment
SET position = ranked.position
FROM ranked
WHERE segment.id = ranked.id;

DROP INDEX IF EXISTS "TravelSegment_tripId_journey_position_idx";
CREATE INDEX "TravelSegment_tripId_position_idx"
ON "TravelSegment"("tripId", position);
CREATE INDEX "TravelSegment_returnForSegmentId_idx"
ON "TravelSegment"("returnForSegmentId");

ALTER TABLE "TravelSegment"
DROP COLUMN journey;

ALTER TABLE "Trip"
DROP COLUMN "tripDirection",
DROP COLUMN "returnNeedsRegeneration";
