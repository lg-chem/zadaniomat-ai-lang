-- AlterTable
ALTER TABLE "Habit" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SportActivity" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
