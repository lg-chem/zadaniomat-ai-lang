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

    const existingGoal = await prisma.goal.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    const {
      title,
      description,
      targetValue,
      currentValue,
      unit,
      isCompleted,
      categoryId,
    } = body

    const updateData: Record<string, unknown> = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (targetValue !== undefined) updateData.targetValue = targetValue ? parseFloat(targetValue) : null
    if (currentValue !== undefined) updateData.currentValue = parseFloat(currentValue)
    if (unit !== undefined) updateData.unit = unit
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted
    if (categoryId !== undefined) updateData.categoryId = categoryId

    const goal = await prisma.goal.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        period: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(goal)
  } catch (error) {
    console.error("Error updating goal:", error)
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

    const existingGoal = await prisma.goal.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    await prisma.goal.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting goal:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
