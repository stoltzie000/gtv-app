ALTER TABLE "TripUpdate"
ADD COLUMN "updateType" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN "travelSegmentId" INTEGER,
ADD COLUMN "itineraryItemId" INTEGER;

CREATE INDEX "TripUpdate_travelSegmentId_idx" ON "TripUpdate"("travelSegmentId");
CREATE INDEX "TripUpdate_itineraryItemId_idx" ON "TripUpdate"("itineraryItemId");

ALTER TABLE "TripUpdate"
ADD CONSTRAINT "TripUpdate_travelSegmentId_fkey"
FOREIGN KEY ("travelSegmentId") REFERENCES "TravelSegment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TripUpdate"
ADD CONSTRAINT "TripUpdate_itineraryItemId_fkey"
FOREIGN KEY ("itineraryItemId") REFERENCES "ItineraryItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
