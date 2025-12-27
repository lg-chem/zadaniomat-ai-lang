import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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
    const { date, notes, minutes } = body

    const habit = await prisma.habit.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 })
    }

    const completionDate = date ? new Date(date) : new Date()
    completionDate.setHours(0, 0, 0, 0)

    // Check if already completed today
    const existing = await prisma.habitCompletion.findUnique({
      where: {
        habitId_date: {
          habitId: id,
          date: completionDate,
        },
      },
    })

    if (existing) {
      // If minutes provided, update existing completion's time instead of toggling off
      if (minutes !== undefined) {
        const updated = await prisma.habitCompletion.update({
          where: { id: existing.id },
          data: { minutes: minutes ? parseInt(minutes) : null },
        })
        return NextResponse.json({ completed: true, minutes: updated.minutes })
      }

      // Toggle off - delete completion
      await prisma.habitCompletion.delete({
        where: { id: existing.id },
      })

      // Update streak (simplified - just decrement if breaking today's streak)
      await prisma.habit.update({
        where: { id },
        data: {
          currentStreak: Math.max(0, habit.currentStreak - 1),
        },
      })

      return NextResponse.json({ completed: false })
    }

    // Determine minutes to save (provided or default from habit)
    const minutesToSave = minutes !== undefined
      ? (minutes ? parseInt(minutes) : null)
      : habit.defaultMinutes

    // Create completion
    await prisma.habitCompletion.create({
      data: {
        habitId: id,
        date: completionDate,
        minutes: minutesToSave,
        notes,
      },
    })

    // Update streak
    const newStreak = habit.currentStreak + 1
    await prisma.habit.update({
      where: { id },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(habit.longestStreak, newStreak),
      },
    })

    return NextResponse.json({ completed: true, streak: newStreak })
  } catch (error) {
    console.error("Error toggling habit completion:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
