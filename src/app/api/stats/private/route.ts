import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
  addDaysKey,
  computeStreak,
  dateOfKey,
  dayKeyOf,
  isDayKey,
  weekStartKey,
  type HabitFrequency,
} from "@/lib/tracking"

// Per user - never rendered at build time
export const dynamic = "force-dynamic"

const WEEKS = 12

/**
 * GET - a year of the private trackers, counted on the server so the page gets
 * a few kilobytes instead of every entry:
 * ?year=2026&today=yyyy-MM-dd
 * - habits: the days done in the year (calendar), totals, streaks (from all days ever done)
 * - weeks: minutes and counts of the last 12 weeks of the year (up to today)
 * - sport: by type, by month, muscle groups, steps
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const todayParam = searchParams.get("today")
    const today = isDayKey(todayParam) ? todayParam : dayKeyOf(new Date())
    const yearParam = parseInt(searchParams.get("year") ?? "")
    const year = Number.isFinite(yearParam) && yearParam > 2000 && yearParam < 2200 ? yearParam : Number(today.slice(0, 4))
    const from = `${year}-01-01`
    const to = `${year}-12-31`
    const range = { gte: dateOfKey(from), lte: dateOfKey(to) }

    const [habits, completions, activities, steps] = await Promise.all([
      // Finished habits too - their history stays in the statistics
      prisma.habit.findMany({
        where: { userId },
        select: { id: true, name: true, color: true, frequency: true, targetCount: true, unit: true, isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.habitCompletion.findMany({
        where: { habit: { userId } },
        select: { habitId: true, date: true, minutes: true, count: true },
      }),
      prisma.sportActivity.findMany({
        where: { userId, date: range, fromSteps: false },
        select: {
          date: true,
          duration: true,
          type: { select: { id: true, name: true, color: true } },
          bodyParts: { select: { name: true } },
        },
      }),
      prisma.stepsEntry.findMany({ where: { userId, date: range }, select: { date: true, count: true } }),
    ])

    // The 12 weeks shown as bars: ending with the running week, or with the year's last one
    const lastDay = today < to ? (today < from ? from : today) : to
    const lastWeek = weekStartKey(lastDay)
    const weekKeysList = Array.from({ length: WEEKS }, (_, i) => addDaysKey(lastWeek, -7 * (WEEKS - 1 - i)))
    const weeks = new Map(
      weekKeysList.map((week) => [week, { week, habitMinutes: 0, sportMinutes: 0, habitDone: 0, workouts: 0 }])
    )

    const perHabit = new Map<string, { allDays: string[]; days: string[]; minutes: number; count: number }>()
    for (const habit of habits) perHabit.set(habit.id, { allDays: [], days: [], minutes: 0, count: 0 })
    const activeDays = new Set<string>()

    for (const completion of completions) {
      const stat = perHabit.get(completion.habitId)
      if (!stat) continue
      const day = dayKeyOf(completion.date)
      stat.allDays.push(day)
      const week = weeks.get(weekStartKey(day))
      if (week) {
        week.habitDone++
        week.habitMinutes += completion.minutes ?? 0
      }
      if (day < from || day > to) continue
      stat.days.push(day)
      stat.minutes += completion.minutes ?? 0
      stat.count += completion.count
      activeDays.add(day)
    }

    const byType = new Map<string, { id: string; name: string; color: string; count: number; minutes: number }>()
    const byMonth = Array.from({ length: 12 }, () => 0)
    const bodyParts = new Map<string, number>()
    let sportMinutes = 0
    for (const activity of activities) {
      const day = dayKeyOf(activity.date)
      activeDays.add(day)
      sportMinutes += activity.duration ?? 0
      byMonth[Number(day.slice(5, 7)) - 1]++
      const type = byType.get(activity.type.id) ?? { ...activity.type, count: 0, minutes: 0 }
      type.count++
      type.minutes += activity.duration ?? 0
      byType.set(activity.type.id, type)
      for (const part of activity.bodyParts) bodyParts.set(part.name, (bodyParts.get(part.name) ?? 0) + 1)
      const week = weeks.get(weekStartKey(day))
      if (week) {
        week.workouts++
        week.sportMinutes += activity.duration ?? 0
      }
    }

    const stepsTotal = steps.reduce((sum, s) => sum + s.count, 0)

    return NextResponse.json({
      year,
      today,
      habits: habits
        .map((habit) => {
          const stat = perHabit.get(habit.id)!
          const frequency = habit.frequency as HabitFrequency
          const streak = computeStreak(frequency, habit.targetCount, stat.allDays, today)
          return {
            ...habit,
            days: stat.days.sort(),
            minutes: stat.minutes,
            count: stat.count,
            currentStreak: streak.current,
            longestStreak: streak.longest,
          }
        })
        // A finished habit with nothing in this year has nothing to show
        .filter((habit) => habit.isActive || habit.days.length > 0),
      weeks: Array.from(weeks.values()),
      sport: {
        total: activities.length,
        minutes: sportMinutes,
        byType: Array.from(byType.values()).sort((a, b) => b.count - a.count),
        byMonth,
        bodyParts: Array.from(bodyParts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      },
      steps: {
        total: stepsTotal,
        days: steps.length,
        average: steps.length ? Math.round(stepsTotal / steps.length) : 0,
      },
      totals: {
        activeDays: activeDays.size,
        habitDone: Array.from(perHabit.values()).reduce((sum, s) => sum + s.days.length, 0),
        habitMinutes: Array.from(perHabit.values()).reduce((sum, s) => sum + s.minutes, 0),
      },
    })
  } catch (error) {
    console.error("Error counting private stats:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
