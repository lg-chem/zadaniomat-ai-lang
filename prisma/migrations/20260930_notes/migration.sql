-- Notes: quick notes not tied to a task, and the time a task description was last changed (notes feed)

-- AlterTable
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "descriptionUpdatedAt" TIMESTAMP(3);

-- Existing descriptions count as changed at the task's last update
UPDATE "Task"
SET "descriptionUpdatedAt" = "updatedAt"
WHERE "descriptionUpdatedAt" IS NULL AND "description" IS NOT NULL AND "description" <> '';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "workspaceType" "WorkspaceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_userId_workspaceType_updatedAt_idx" ON "Note"("userId", "workspaceType", "updatedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
