import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { refreshHabitStreak } from "@/lib/habit-data"
import { dateOfKey, dayKeyOf, isDayKey } from "@/lib/tracking"

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = parseInt(String(value))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Marks a habit on a day.
 * body: { date: yyyy-MM-dd, done?: boolean, minutes?, count?, notes?, today? }
 * - done: true / false sets the day (asking twice changes nothing more);
 *   without it the day is switched - unless minutes / count / notes come, which only fill the day in
 * - today: the user's day, the streak is counted to it
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { date, notes, minutes, count, done } = body

    const habit = await prisma.habit.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 })
    }

    const serverToday = dayKeyOf(new Date())
    const day = isDayKey(date) ? date : serverToday
    const today = isDayKey(body.today) ? body.today : serverToday
    const completionDate = dateOfKey(day)

    const existing = await prisma.habitCompletion.findUnique({
      where: { habitId_date: { habitId: id, date: completionDate } },
    })

    const hasDetails = minutes !== undefined || count !== undefined || notes !== undefined
    const wantsDone = typeof done === "boolean" ? done : existing ? hasDetails : true

    let completion = existing
    if (!wantsDone) {
      if (existing) await prisma.habitCompletion.delete({ where: { id: existing.id } })
      completion = null
    } else if (existing) {
      if (hasDetails) {
        completion = await prisma.habitCompletion.update({
          where: { id: existing.id },
          data: {
            ...(minutes !== undefined && { minutes: toInt(minutes) }),
            ...(count !== undefined && { count: Math.max(1, toInt(count) ?? 1) }),
            ...(notes !== undefined && { notes: notes ? String(notes) : null }),
          },
        })
      }
    } else {
      completion = await prisma.habitCompletion.create({
        data: {
          habitId: id,
          date: completionDate,
          minutes: minutes !== undefined ? toInt(minutes) : habit.defaultMinutes,
          count: Math.max(1, toInt(count) ?? 1),
          notes: notes ? String(notes) : null,
        },
      })
    }

    // Counted from the days really done - also right after filling in a past day or undoing one
    const streak = await refreshHabitStreak(id, today)

    return NextResponse.json({
      completed: !!completion,
      completion,
      minutes: completion?.minutes ?? null,
      streak: streak?.currentStreak ?? 0,
      ...streak,
    })
  } catch (error) {
    console.error("Error toggling habit completion:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
