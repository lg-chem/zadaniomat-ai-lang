import prisma from "@/lib/prisma"
import {
  computeStreak,
  dateOfKey,
  dayKeyOf,
  habitTarget,
  periodRange,
  type HabitFrequency,
} from "@/lib/tracking"

interface LoadHabitsOptions {
  /** Completions of these days come with each habit; none when not given */
  from?: string | null
  to?: string | null
  /** The user's today - streaks and "this week 2/3" are counted to it */
  today: string
}

/**
 * Active habits of the user with the completions of the asked days, and the streak
 * and this period's count worked out from the days really done (the streak kept on
 * the habit only changes on a click - it does not drop when days are skipped).
 */
export async function loadHabits(userId: string, { from, to, today }: LoadHabitsOptions) {
  const [habits, doneRows] = await Promise.all([
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: {
        category: { select: { id: true, name: true, color: true } },
        completions:
          from && to
            ? { where: { date: { gte: dateOfKey(from), lte: dateOfKey(to) } }, orderBy: { date: "desc" } }
            : false,
      },
      orderBy: { createdAt: "asc" },
    }),
    // Days only - every day ever done is needed for the streak, the rest of the row is not
    prisma.habitCompletion.findMany({
      where: { habit: { userId, isActive: true } },
      select: { habitId: true, date: true },
    }),
  ])

  const doneByHabit = new Map<string, string[]>()
  for (const row of doneRows) {
    const days = doneByHabit.get(row.habitId)
    const day = dayKeyOf(row.date)
    if (days) days.push(day)
    else doneByHabit.set(row.habitId, [day])
  }

  return habits.map((habit) => {
    const frequency = habit.frequency as HabitFrequency
    const days = doneByHabit.get(habit.id) ?? []
    const streak = computeStreak(frequency, habit.targetCount, days, today)
    const period = periodRange(frequency, today)
    return {
      ...habit,
      completions: habit.completions ?? [],
      currentStreak: streak.current,
      longestStreak: streak.longest,
      periodDone: days.filter((day) => day >= period.from && day <= period.to).length,
      periodTarget: habitTarget(frequency, habit.targetCount),
    }
  })
}

/** Streak of one habit counted from its days; saved on the habit so every other view reads the same */
export async function refreshHabitStreak(habitId: string, today: string) {
  const habit = await prisma.habit.findUnique({
    where: { id: habitId },
    select: { frequency: true, targetCount: true, currentStreak: true, longestStreak: true },
  })
  if (!habit) return null
  const rows = await prisma.habitCompletion.findMany({ where: { habitId }, select: { date: true } })
  const frequency = habit.frequency as HabitFrequency
  const days = rows.map((row) => dayKeyOf(row.date))
  const streak = computeStreak(frequency, habit.targetCount, days, today)
  if (streak.current !== habit.currentStreak || streak.longest !== habit.longestStreak) {
    await prisma.habit.update({
      where: { id: habitId },
      data: { currentStreak: streak.current, longestStreak: streak.longest },
    })
  }
  const period = periodRange(frequency, today)
  return {
    currentStreak: streak.current,
    longestStreak: streak.longest,
    periodDone: days.filter((day) => day >= period.from && day <= period.to).length,
    periodTarget: habitTarget(frequency, habit.targetCount),
  }
}
