import prisma from "@/lib/prisma"
import { toDayString } from "@/lib/calendar"
import type { RecurrenceContext } from "@/lib/task-recurrence"

// Server only: sprint and period end dates for "before the end of the sprint / period" rules
export async function loadRecurrenceContext(
  userId: string,
  workspaceType: "WORK" | "PRIVATE",
  rules: (string | null | undefined)[]
): Promise<RecurrenceContext> {
  const needsSprints = rules.some((rule) => rule?.startsWith("SPRINT_END"))
  const needsPeriods = rules.some((rule) => rule?.startsWith("PERIOD_END"))
  if (!needsSprints && !needsPeriods) return {}

  const [sprints, periods] = await Promise.all([
    needsSprints
      ? prisma.sprint.findMany({
          where: { period: { userId, workspaceType } },
          select: { endDate: true },
        })
      : [],
    needsPeriods
      ? prisma.period.findMany({
          where: { userId, workspaceType },
          select: { endDate: true },
        })
      : [],
  ])

  return {
    sprintEnds: sprints.map((s) => toDayString(s.endDate)),
    periodEnds: periods.map((p) => toDayString(p.endDate)),
  }
}

export function utcTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}
