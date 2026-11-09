-- Tasks of a quarter goal or sprint commitment are read on every goals page load and
-- every task status change (goal progress) - without the index each read scans all tasks

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_goalId_idx" ON "Task"("goalId");
