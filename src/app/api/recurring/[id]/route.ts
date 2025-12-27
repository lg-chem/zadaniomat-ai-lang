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

    const existing = await prisma.task.findFirst({
      where: { id, userId: session.user.id, isRecurring: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const {
      title,
      description,
      recurrenceRule,
      scheduledTime,
      plannedMinutes,
      priority,
      categoryId,
      isRecurring,
    } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (recurrenceRule !== undefined) updateData.recurrenceRule = recurrenceRule
    if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime
    if (plannedMinutes !== undefined) updateData.plannedMinutes = plannedMinutes
    if (priority !== undefined) updateData.priority = priority
    if (categoryId !== undefined) updateData.categoryId = categoryId || null
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error("Error updating recurring task:", error)
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

    const existing = await prisma.task.findFirst({
      where: { id, userId: session.user.id, isRecurring: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    await prisma.task.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting recurring task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
