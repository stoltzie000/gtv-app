ALTER TABLE "Trip"
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "destination" TEXT NOT NULL DEFAULT '',
ADD COLUMN "startLocation" TEXT NOT NULL DEFAULT '',
ADD COLUMN "overviewStatus" TEXT NOT NULL DEFAULT 'Not Started',
ADD COLUMN "itineraryStatus" TEXT NOT NULL DEFAULT 'Not Started',
ADD COLUMN "travelStatus" TEXT NOT NULL DEFAULT 'Not Started',
ADD COLUMN "documentsStatus" TEXT NOT NULL DEFAULT 'Not Started',
ADD COLUMN "photosStatus" TEXT NOT NULL DEFAULT 'Not Started';

CREATE TABLE "ItineraryItem" (
  "id" SERIAL NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "time" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tripId" INTEGER NOT NULL,
  CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TravelSegment" (
  "id" SERIAL NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tripId" INTEGER NOT NULL,
  CONSTRAINT "TravelSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TripDocument" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tripId" INTEGER NOT NULL,
  CONSTRAINT "TripDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TripPhoto" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tripId" INTEGER NOT NULL,
  CONSTRAINT "TripPhoto_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelSegment" ADD CONSTRAINT "TravelSegment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripDocument" ADD CONSTRAINT "TripDocument_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripPhoto" ADD CONSTRAINT "TripPhoto_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ItineraryItem_tripId_date_idx" ON "ItineraryItem"("tripId", "date");
CREATE INDEX "TravelSegment_tripId_idx" ON "TravelSegment"("tripId");
CREATE INDEX "TripDocument_tripId_idx" ON "TripDocument"("tripId");
CREATE INDEX "TripPhoto_tripId_idx" ON "TripPhoto"("tripId");
