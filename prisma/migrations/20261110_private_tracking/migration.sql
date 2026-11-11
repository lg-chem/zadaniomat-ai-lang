-- Private tracking: habits counted in own units and shown in the plan of the day,
-- challenges that count themselves from a habit / sport / steps.
-- The app adds these columns itself on its first request after the deploy
-- (src/lib/schema-guard.ts) - this file is the same change for a manual run.

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "scheduledTime" TEXT;

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "linkedType" "LinkedDataType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "linkedHabitId" TEXT;
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "linkedSportTypeId" TEXT;
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "linkedMetric" TEXT NOT NULL DEFAULT 'COUNT';
