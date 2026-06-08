ALTER TABLE "Trip" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Trip"
SET "isPublished" = true
WHERE "status" = 'Published';

UPDATE "Trip"
SET "status" = 'Not Started'
WHERE "status" IN ('Draft', 'Published');

ALTER TABLE "Trip" ALTER COLUMN "status" SET DEFAULT 'Not Started';
