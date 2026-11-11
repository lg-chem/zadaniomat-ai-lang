import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import {
  challengeProgress,
  dateOfKey,
  dayKeyOf,
  type ChallengeType,
  type LinkedMetric,
  type LinkedType,
} from "@/lib/tracking"

const withEntries = {
  milestones: { orderBy: { targetValue: "asc" } },
  entries: { orderBy: { date: "desc" } },
} satisfies Prisma.ChallengeInclude

type ChallengeRow = Prisma.ChallengeGetPayload<{ include: typeof withEntries }>

interface LinkedEntry {
  id: string
  date: Date
  value: number
  notes: string | null
  createdAt: Date
  challengeId: string
}

/** What a linked challenge counts, in words: "Siłownia", "nawyk Czytanie · minuty" */
function linkedLabel(
  challenge: ChallengeRow,
  habitNames: Map<string, string>,
  sportTypeNames: Map<string, string>
): string | null {
  const linkedType = challenge.linkedType as LinkedType
  if (linkedType === "HABIT") {
    const name = challenge.linkedHabitId ? habitNames.get(challenge.linkedHabitId) : null
    return name ? `nawyk ${name}` : "nawyk (usunięty)"
  }
  if (linkedType === "SPORT") {
    if (!challenge.linkedSportTypeId) return "każdy trening"
    return sportTypeNames.get(challenge.linkedSportTypeId) ?? "sport (usunięty typ)"
  }
  if (linkedType === "STEPS") return "kroki"
  return null
}

/**
 * Challenges of the user. A challenge linked to a habit / sport / steps gets its
 * entries and progress counted from that data here, on every read - nothing has to
 * be ticked twice and nothing can go out of step. Own entries stay as they are.
 */
export async function loadChallenges(userId: string, options: { showCompleted: boolean }) {
  const challenges = await prisma.challenge.findMany({
    where: { userId, ...(options.showCompleted ? {} : { isCompleted: false }) },
    include: withEntries,
    orderBy: { endDate: "asc" },
  })

  const linked = challenges.filter((c) => c.linkedType !== "NONE")
  if (linked.length === 0) {
    return challenges.map((challenge) => ({ ...challenge, linkedLabel: null as string | null }))
  }

  // One read per kind of source, for the days all linked challenges cover together
  const from = linked.reduce((min, c) => (c.startDate < min ? c.startDate : min), linked[0].startDate)
  const to = linked.reduce((max, c) => (c.endDate > max ? c.endDate : max), linked[0].endDate)
  const range = { gte: dateOfKey(dayKeyOf(from)), lte: dateOfKey(dayKeyOf(to)) }
  const habitIds = Array.from(
    new Set(linked.filter((c) => c.linkedType === "HABIT" && c.linkedHabitId).map((c) => c.linkedHabitId as string))
  )
  const needsSport = linked.some((c) => c.linkedType === "SPORT")
  const needsSteps = linked.some((c) => c.linkedType === "STEPS")

  const [habits, completions, activities, sportTypes, steps] = await Promise.all([
    habitIds.length
      ? prisma.habit.findMany({ where: { userId, id: { in: habitIds } }, select: { id: true, name: true } })
      : [],
    habitIds.length
      ? prisma.habitCompletion.findMany({
          where: { habitId: { in: habitIds }, habit: { userId }, date: range },
          select: { id: true, habitId: true, date: true, minutes: true, count: true, createdAt: true },
        })
      : [],
    needsSport
      ? prisma.sportActivity.findMany({
          where: { userId, date: range },
          select: { id: true, typeId: true, date: true, duration: true, fromSteps: true, createdAt: true },
        })
      : [],
    needsSport ? prisma.sportActivityType.findMany({ where: { userId }, select: { id: true, name: true } }) : [],
    needsSteps
      ? prisma.stepsEntry.findMany({
          where: { userId, date: range },
          select: { id: true, date: true, count: true, createdAt: true },
        })
      : [],
  ])

  const habitNames = new Map(habits.map((h) => [h.id, h.name]))
  const sportTypeNames = new Map(sportTypes.map((t) => [t.id, t.name]))
  const updates: Promise<unknown>[] = []

  const result = challenges.map((challenge) => {
    const linkedType = challenge.linkedType as LinkedType
    if (linkedType === "NONE") return { ...challenge, linkedLabel: null as string | null }

    const type = challenge.challengeType as ChallengeType
    const metric = challenge.linkedMetric as LinkedMetric
    const start = dayKeyOf(challenge.startDate)
    const end = dayKeyOf(challenge.endDate)
    const inRange = (date: Date) => {
      const day = dayKeyOf(date)
      return day >= start && day <= end
    }
    const entry = (id: string, date: Date, value: number, createdAt: Date): LinkedEntry => ({
      id: `linked-${id}`,
      date,
      value,
      notes: null,
      createdAt,
      challengeId: challenge.id,
    })
    // Sums only make sense for a numeric target; weekly / monthly / daily count days and sessions
    const summed = type === "NUMERIC"

    let entries: LinkedEntry[] = []
    if (linkedType === "HABIT") {
      entries = completions
        .filter((c) => c.habitId === challenge.linkedHabitId && inRange(c.date))
        .map((c) =>
          entry(
            c.id,
            c.date,
            summed && metric === "MINUTES" ? c.minutes ?? 0 : summed && metric === "VALUE" ? c.count : 1,
            c.createdAt
          )
        )
    } else if (linkedType === "SPORT") {
      entries = activities
        .filter((a) =>
          challenge.linkedSportTypeId
            ? a.typeId === challenge.linkedSportTypeId
            : // "Every workout" - without the walks copied from the steps
              !a.fromSteps
        )
        .filter((a) => inRange(a.date))
        .map((a) => entry(a.id, a.date, summed && metric === "MINUTES" ? a.duration ?? 0 : 1, a.createdAt))
    } else if (linkedType === "STEPS") {
      entries = steps.filter((s) => inRange(s.date)).map((s) => entry(s.id, s.date, summed ? s.count : 1, s.createdAt))
    }
    entries.sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime())

    const currentValue = challengeProgress(type, entries, challenge.startDate, challenge.weeklyTarget)
    // Same rule as with own entries: weekly / monthly / daily close themselves at the target
    const isCompleted = challenge.isCompleted || (type !== "NUMERIC" && currentValue >= challenge.targetValue)

    // Kept on the challenge too - other views read the saved numbers
    if (currentValue !== challenge.currentValue || isCompleted !== challenge.isCompleted) {
      updates.push(
        prisma.challenge.update({ where: { id: challenge.id }, data: { currentValue, isCompleted } }).catch(() => null)
      )
    }

    return {
      ...challenge,
      entries,
      currentValue,
      isCompleted,
      linkedLabel: linkedLabel(challenge, habitNames, sportTypeNames),
    }
  })

  await Promise.all(updates)
  // A challenge that has just closed itself leaves the list of the active ones on the next read
  return result
}

/** Checks the link fields of a new / changed challenge; returns what to save or an error text */
export async function readLinkFields(
  userId: string,
  body: { linkedType?: unknown; linkedHabitId?: unknown; linkedSportTypeId?: unknown; linkedMetric?: unknown }
): Promise<
  | { error: string }
  | { data: { linkedType: LinkedType; linkedHabitId: string | null; linkedSportTypeId: string | null; linkedMetric: LinkedMetric } }
> {
  const linkedType = (["HABIT", "SPORT", "STEPS"].includes(body.linkedType as string) ? body.linkedType : "NONE") as LinkedType
  const metric = (["MINUTES", "VALUE"].includes(body.linkedMetric as string) ? body.linkedMetric : "COUNT") as LinkedMetric
  const data = { linkedType, linkedHabitId: null as string | null, linkedSportTypeId: null as string | null, linkedMetric: metric }

  if (linkedType === "HABIT") {
    const habit =
      typeof body.linkedHabitId === "string"
        ? await prisma.habit.findFirst({ where: { id: body.linkedHabitId, userId }, select: { id: true } })
        : null
    if (!habit) return { error: "Wybierz nawyk, z którego ma się liczyć wyzwanie" }
    data.linkedHabitId = habit.id
  } else if (linkedType === "SPORT") {
    if (typeof body.linkedSportTypeId === "string" && body.linkedSportTypeId) {
      const type = await prisma.sportActivityType.findFirst({
        where: { id: body.linkedSportTypeId, OR: [{ userId }, { isDefault: true }] },
        select: { id: true },
      })
      if (!type) return { error: "Nie ma takiego typu aktywności" }
      data.linkedSportTypeId = type.id
    }
    if (data.linkedMetric === "VALUE") data.linkedMetric = "COUNT"
  } else {
    data.linkedMetric = "COUNT"
  }
  return { data }
}
