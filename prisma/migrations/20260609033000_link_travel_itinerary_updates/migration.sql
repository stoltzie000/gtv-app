-- Preserve the travel-segment provenance of generated itinerary items and updates.
-- These are historical identifiers rather than foreign keys so segment deletion
-- does not remove update history from the corresponding itinerary item.
ALTER TABLE "ItineraryItem" ADD COLUMN "sourceTravelSegmentId" INTEGER;
ALTER TABLE "TripUpdate" ADD COLUMN "sourceTravelSegmentId" INTEGER;

UPDATE "TripUpdate"
SET "sourceTravelSegmentId" = "travelSegmentId"
WHERE "updateType" = 'TRAVEL' AND "travelSegmentId" IS NOT NULL;

CREATE INDEX "ItineraryItem_sourceTravelSegmentId_idx" ON "ItineraryItem"("sourceTravelSegmentId");
CREATE INDEX "TripUpdate_sourceTravelSegmentId_idx" ON "TripUpdate"("sourceTravelSegmentId");
