ALTER TABLE "User" ADD COLUMN "inactivityWarningAt" TIMESTAMP(3);
ALTER TABLE "Trip" ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "Trip" SET "completedAt" = CURRENT_TIMESTAMP WHERE "status" = 'Completed';

CREATE TABLE "AccountDeletionAudit" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountDeletionAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupRun" (
  "id" SERIAL NOT NULL,
  "status" TEXT NOT NULL,
  "objectKey" TEXT,
  "size" INTEGER,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Trip_completedAt_idx" ON "Trip"("completedAt");
CREATE INDEX "AccountDeletionAudit_deletedAt_idx" ON "AccountDeletionAudit"("deletedAt");
CREATE INDEX "BackupRun_startedAt_idx" ON "BackupRun"("startedAt");

ALTER TABLE "Trip" DROP CONSTRAINT "Trip_ownerId_fkey";
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
