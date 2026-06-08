ALTER TABLE "Trip" ADD COLUMN "shareToken" TEXT;

CREATE TABLE "TripUpdate" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tripId" INTEGER NOT NULL,
  CONSTRAINT "TripUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Poll" (
  "id" SERIAL NOT NULL,
  "question" TEXT NOT NULL,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tripId" INTEGER NOT NULL,
  CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollOption" (
  "id" SERIAL NOT NULL,
  "label" TEXT NOT NULL,
  "pollId" INTEGER NOT NULL,
  CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollVote" (
  "id" SERIAL NOT NULL,
  "voterId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pollId" INTEGER NOT NULL,
  "optionId" INTEGER NOT NULL,
  CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Trip_shareToken_key" ON "Trip"("shareToken");
CREATE INDEX "TripUpdate_tripId_createdAt_idx" ON "TripUpdate"("tripId", "createdAt");
CREATE INDEX "Poll_tripId_createdAt_idx" ON "Poll"("tripId", "createdAt");
CREATE UNIQUE INDEX "PollVote_pollId_voterId_key" ON "PollVote"("pollId", "voterId");
CREATE INDEX "PollVote_optionId_idx" ON "PollVote"("optionId");

ALTER TABLE "TripUpdate" ADD CONSTRAINT "TripUpdate_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
