ALTER TABLE "User"
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "inactiveAt" TIMESTAMP(3),
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);

ALTER TABLE "Trip"
ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "draftReminderAt" TIMESTAMP(3),
ADD COLUMN "travelerViewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "qrScanCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "User_lastActivityAt_idx" ON "User"("lastActivityAt");
CREATE INDEX "Trip_lastActivityAt_idx" ON "Trip"("lastActivityAt");
CREATE INDEX "Trip_endDate_idx" ON "Trip"("endDate");
