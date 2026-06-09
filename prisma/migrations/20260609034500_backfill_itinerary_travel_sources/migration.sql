-- Backfill provenance only when an existing itinerary item uniquely matches the
-- exact content generated from one travel segment. Ambiguous/manual items remain
-- unlinked rather than receiving updates from the wrong segment.
WITH candidates AS (
  SELECT
    itinerary.id AS "itineraryItemId",
    MIN(segment.id) AS "sourceTravelSegmentId"
  FROM "ItineraryItem" AS itinerary
  JOIN "Trip" AS trip ON trip.id = itinerary."tripId"
  JOIN "TravelSegment" AS segment
    ON segment."tripId" = itinerary."tripId"
    AND itinerary.title = CONCAT(
      segment.type,
      ': ',
      COALESCE(NULLIF(segment."startLocation", ''), 'Start'),
      ' to ',
      COALESCE(NULLIF(segment.destination, ''), 'Destination')
    )
    AND itinerary.date = COALESCE(
      segment.date,
      CASE WHEN segment.journey = 'RETURN' THEN trip."endDate" ELSE trip."startDate" END
    )
    AND itinerary.time = COALESCE(NULLIF(segment.time, ''), '00:00')
    AND itinerary.description = CONCAT_WS(
      E'\n',
      NULLIF(segment.title, ''),
      NULLIF(segment.description, '')
    )
  WHERE itinerary."sourceTravelSegmentId" IS NULL
  GROUP BY itinerary.id
  HAVING COUNT(segment.id) = 1
)
UPDATE "ItineraryItem" AS itinerary
SET "sourceTravelSegmentId" = candidates."sourceTravelSegmentId"
FROM candidates
WHERE itinerary.id = candidates."itineraryItemId";
