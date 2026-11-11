import type { PrismaClient } from "@prisma/client"

// Columns added after the database was first created. The deploy does not run
// migrations, and a missing column fails every read of its table - so the app adds
// them itself, once per server start, before the first query. Only additions that
// change nothing for the code already running (new columns with a default).
// The same change as SQL: prisma/migrations/20261110_private_tracking.
const COLUMNS: { table: string; column: string; definition: string }[] = [
  { table: "Habit", column: "unit", definition: "TEXT" },
  { table: "Habit", column: "scheduledTime", definition: "TEXT" },
  { table: "Challenge", column: "linkedType", definition: `"LinkedDataType" NOT NULL DEFAULT 'NONE'` },
  { table: "Challenge", column: "linkedHabitId", definition: "TEXT" },
  { table: "Challenge", column: "linkedSportTypeId", definition: "TEXT" },
  { table: "Challenge", column: "linkedMetric", definition: "TEXT NOT NULL DEFAULT 'COUNT'" },
]

let ready: Promise<void> | null = null

async function addMissingColumns(prisma: PrismaClient) {
  const existing = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name IN ('Habit', 'Challenge')`
  )
  // Tables not created yet (an empty database) - nothing to add to
  if (existing.length === 0) return
  const has = new Set(existing.map((c) => `${c.table_name}.${c.column_name}`))
  for (const { table, column, definition } of COLUMNS) {
    if (has.has(`${table}.${column}`)) continue
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`)
  }
}

/** Resolves once the database has every column the code reads */
export function ensureSchema(prisma: PrismaClient): Promise<void> {
  if (!ready) {
    ready = addMissingColumns(prisma).catch((error) => {
      // Queries go on - they work when the columns are there, and fail with the real reason when not
      console.error("Schema check failed:", error)
    })
  }
  return ready
}
