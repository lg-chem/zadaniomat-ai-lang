import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { refreshHabitStreak } from "@/lib/habit-data"
import { dayKeyOf, isDayKey } from "@/lib/tracking"

export async function PATCH(
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

    const existingHabit = await prisma.habit.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingHabit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 })
    }

    const {
      name, description, frequency, targetCount, color, icon, categoryId, isActive, isPublic, defaultMinutes,
      unit, scheduledTime,
    } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (frequency !== undefined) updateData.frequency = frequency
    if (targetCount !== undefined) updateData.targetCount = Math.max(1, parseInt(targetCount) || 1)
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (categoryId !== undefined) updateData.categoryId = categoryId || null
    if (isActive !== undefined) updateData.isActive = isActive
    if (isPublic !== undefined) updateData.isPublic = isPublic
    if (defaultMinutes !== undefined) updateData.defaultMinutes = defaultMinutes ? parseInt(defaultMinutes) : null
    if (unit !== undefined) updateData.unit = unit ? String(unit).trim().slice(0, 20) : null
    if (scheduledTime !== undefined) {
      updateData.scheduledTime =
        typeof scheduledTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime) ? scheduledTime : null
    }

    const habit = await prisma.habit.update({
      where: { id },
      data: updateData,
      include: { category: true },
    })

    // The rhythm decides what a streak is (days / weeks with the target met) - count it again
    if (frequency !== undefined || targetCount !== undefined) {
      const today = isDayKey(body.today) ? body.today : dayKeyOf(new Date())
      await refreshHabitStreak(id, today)
    }

    return NextResponse.json(habit)
  } catch (error) {
    console.error("Error updating habit:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    const existingHabit = await prisma.habit.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingHabit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 })
    }

    await prisma.habit.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting habit:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
