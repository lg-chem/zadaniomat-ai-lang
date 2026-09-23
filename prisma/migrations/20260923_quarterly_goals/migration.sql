-- Quarterly goals: calendar quarters, sprint planning/retro, key results and weekly check-ins

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GoalKind" AS ENUM ('QUARTER', 'COMMITMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Period" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "Period" ADD COLUMN IF NOT EXISTS "quarter" INTEGER;
ALTER TABLE "Period" ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;
ALTER TABLE "Period" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN IF NOT EXISTS "number" INTEGER;
ALTER TABLE "Sprint" ADD COLUMN IF NOT EXISTS "sprintGoal" TEXT;
ALTER TABLE "Sprint" ADD COLUMN IF NOT EXISTS "plannedAt" TIMESTAMP(3);
ALTER TABLE "Sprint" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "kind" "GoalKind";
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "why" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "obstacle" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "ifThenPlan" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "leadMeasure" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "leadTarget" DOUBLE PRECISION;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "score" DOUBLE PRECISION;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "carriedOver" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "KeyResult" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT,
    "startValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "goalId" TEXT NOT NULL,

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KeyResultEntry" (
    "id" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keyResultId" TEXT NOT NULL,

    CONSTRAINT "KeyResultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoalCheckIn" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "confidence" INTEGER,
    "leadActual" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "goalId" TEXT NOT NULL,

    CONSTRAINT "GoalCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KeyResult_goalId_idx" ON "KeyResult"("goalId");
CREATE INDEX IF NOT EXISTS "KeyResultEntry_keyResultId_createdAt_idx" ON "KeyResultEntry"("keyResultId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "GoalCheckIn_goalId_weekStart_key" ON "GoalCheckIn"("goalId", "weekStart");
CREATE UNIQUE INDEX IF NOT EXISTS "Period_userId_workspaceType_year_quarter_key" ON "Period"("userId", "workspaceType", "year", "quarter");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "KeyResultEntry" ADD CONSTRAINT "KeyResultEntry_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "KeyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GoalCheckIn" ADD CONSTRAINT "GoalCheckIn_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
