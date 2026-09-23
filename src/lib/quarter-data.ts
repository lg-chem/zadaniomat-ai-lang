import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  buildQuarterSchedule,
  dayKeyToDate,
  quarterLabel,
  toDayKey,
  type QuarterPayload,
  type QuarterRef,
  type SprintHistory,
} from "@/lib/quarters"

// Server-only helpers for the quarterly goals module (WORK workspace only)

const trackedSecondsOf = (tasks: { actualMinutes: number; actualExtraSeconds: number }[]) =>
  tasks.reduce((sum, t) => sum + t.actualMinutes * 60 + t.actualExtraSeconds, 0)

export async function findQuarterPeriod(userId: string, ref: QuarterRef) {
  return prisma.period.findUnique({
    where: {
      userId_workspaceType_year_quarter: {
        userId,
        workspaceType: "WORK",
        year: ref.year,
        quarter: ref.quarter,
      },
    },
  })
}

/** Creates the quarter with its 6 sprints; returns the existing one if it is already there */
export async function ensureQuarter(userId: string, ref: QuarterRef) {
  const existing = await findQuarterPeriod(userId, ref)
  if (existing) return existing

  const schedule = buildQuarterSchedule(ref)
  try {
    return await prisma.period.create({
      data: {
        name: quarterLabel(ref),
        startDate: dayKeyToDate(schedule.startKey),
        endDate: dayKeyToDate(schedule.endKey),
        workspaceType: "WORK",
        year: ref.year,
        quarter: ref.quarter,
        userId,
        sprints: {
          create: schedule.sprints.map((s) => ({
            name: s.name,
            number: s.number,
            startDate: dayKeyToDate(s.startKey),
            endDate: dayKeyToDate(s.endKey),
          })),
        },
      },
    })
  } catch (error) {
    // Created in parallel (e.g. two tabs) - return the winner
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const period = await findQuarterPeriod(userId, ref)
      if (period) return period
    }
    throw error
  }
}

/** Full quarter view: goals with key results and check-ins, sprints with commitments */
export async function loadQuarter(userId: string, ref: QuarterRef): Promise<QuarterPayload | null> {
  const period = await prisma.period.findUnique({
    where: {
      userId_workspaceType_year_quarter: {
        userId,
        workspaceType: "WORK",
        year: ref.year,
        quarter: ref.quarter,
      },
    },
    include: {
      sprints: {
        orderBy: { startDate: "asc" },
        include: { retrospective: true },
      },
    },
  })
  if (!period) return null

  const sprintIds = period.sprints.map((s) => s.id)

  const [goals, commitments] = await Promise.all([
    prisma.goal.findMany({
      where: {
        userId,
        periodId: period.id,
        sprintId: null,
        parentGoalId: null,
        isStep: false,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        category: { select: { id: true, name: true, color: true } },
        keyResults: {
          orderBy: { order: "asc" },
          include: {
            entries: { orderBy: { createdAt: "asc" }, select: { value: true, createdAt: true } },
          },
        },
        checkIns: { orderBy: { weekStart: "asc" } },
        tasks: {
          where: { status: { not: "CANCELLED" } },
          select: { actualMinutes: true, actualExtraSeconds: true },
        },
      },
    }),
    prisma.goal.findMany({
      where: { userId, sprintId: { in: sprintIds } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        tasks: {
          where: { status: { not: "CANCELLED" } },
          select: { status: true, actualMinutes: true, actualExtraSeconds: true },
        },
      },
    }),
  ])

  const commitmentSecondsByGoal = new Map<string, number>()
  for (const c of commitments) {
    if (!c.parentGoalId) continue
    commitmentSecondsByGoal.set(
      c.parentGoalId,
      (commitmentSecondsByGoal.get(c.parentGoalId) ?? 0) + trackedSecondsOf(c.tasks)
    )
  }

  return {
    id: period.id,
    name: period.name,
    year: ref.year,
    quarter: ref.quarter,
    startKey: toDayKey(period.startDate),
    endKey: toDayKey(period.endDate),
    reviewNotes: period.reviewNotes,
    reviewedAt: period.reviewedAt?.toISOString() ?? null,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      why: g.why,
      obstacle: g.obstacle,
      ifThenPlan: g.ifThenPlan,
      leadMeasure: g.leadMeasure,
      leadTarget: g.leadTarget,
      isCompleted: g.isCompleted,
      score: g.score,
      reviewNote: g.reviewNote,
      carriedOver: g.carriedOver,
      createdAt: g.createdAt.toISOString(),
      category: g.category,
      keyResults: g.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        unit: kr.unit,
        startValue: kr.startValue,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
        order: kr.order,
        entries: kr.entries.map((e) => ({ value: e.value, createdAt: e.createdAt.toISOString() })),
      })),
      checkIns: g.checkIns.map((c) => ({
        weekStart: toDayKey(c.weekStart),
        confidence: c.confidence,
        leadActual: c.leadActual,
        note: c.note,
      })),
      trackedSeconds: trackedSecondsOf(g.tasks) + (commitmentSecondsByGoal.get(g.id) ?? 0),
    })),
    sprints: period.sprints.map((s, index) => ({
      id: s.id,
      name: s.name,
      number: s.number ?? index + 1,
      startKey: toDayKey(s.startDate),
      endKey: toDayKey(s.endDate),
      sprintGoal: s.sprintGoal,
      plannedAt: s.plannedAt?.toISOString() ?? null,
      closedAt: s.closedAt?.toISOString() ?? null,
      retrospective: s.retrospective
        ? {
            wentWell: s.retrospective.wentWell,
            needsImprovement: s.retrospective.needsImprovement,
            actionItems: s.retrospective.actionItems,
            notes: s.retrospective.notes,
          }
        : null,
      commitments: commitments
        .filter((c) => c.sprintId === s.id)
        .map((c) => ({
          id: c.id,
          title: c.title,
          isCompleted: c.isCompleted,
          carriedOver: c.carriedOver,
          parentGoalId: c.parentGoalId,
          taskCount: c.tasks.length,
          completedTaskCount: c.tasks.filter((t) => t.status === "COMPLETED").length,
          trackedSeconds: trackedSecondsOf(c.tasks),
        })),
    })),
  }
}

/** How many commitments were done in the last closed sprints (planning fallacy check) */
export async function loadSprintHistory(userId: string): Promise<SprintHistory> {
  const sprints = await prisma.sprint.findMany({
    where: {
      closedAt: { not: null },
      period: { userId, workspaceType: "WORK" },
    },
    orderBy: { startDate: "desc" },
    take: 3,
    include: {
      goals: {
        where: { userId, kind: "COMMITMENT" },
        select: { isCompleted: true },
      },
    },
  })
  const all = sprints.flatMap((s) => s.goals)
  return {
    sprints: sprints.length,
    done: all.filter((g) => g.isCompleted).length,
    total: all.length,
  }
}

export async function hasAnyQuarter(userId: string): Promise<boolean> {
  const count = await prisma.period.count({
    where: { userId, workspaceType: "WORK", year: { not: null } },
  })
  return count > 0
}

/** Quarter period owned by the user, or null */
export async function findOwnedQuarter(userId: string, periodId: string) {
  return prisma.period.findFirst({
    where: { id: periodId, userId, workspaceType: "WORK", year: { not: null }, quarter: { not: null } },
    include: { sprints: { orderBy: { startDate: "asc" } } },
  })
}

/** Records a new key result value (with history) when it changed */
export async function setKeyResultValue(
  tx: Prisma.TransactionClient,
  keyResult: { id: string; currentValue: number },
  value: number
) {
  if (keyResult.currentValue === value) return
  await tx.keyResult.update({ where: { id: keyResult.id }, data: { currentValue: value } })
  await tx.keyResultEntry.create({ data: { keyResultId: keyResult.id, value } })
}
