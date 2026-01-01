import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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

    const { name, description, frequency, targetCount, color, icon, categoryId, isActive, currentStreak, longestStreak } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (frequency !== undefined) updateData.frequency = frequency
    if (targetCount !== undefined) updateData.targetCount = targetCount
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (isActive !== undefined) updateData.isActive = isActive
    if (currentStreak !== undefined) updateData.currentStreak = currentStreak
    if (longestStreak !== undefined) updateData.longestStreak = longestStreak
    // if (isPublic !== undefined) updateData.isPublic = isPublic // TODO: uncomment after running migration

    const habit = await prisma.habit.update({
      where: { id },
      data: updateData,
      include: { category: true },
    })

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
