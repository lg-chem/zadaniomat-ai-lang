import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const task = await prisma.task.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        category: true,
        timeEntries: true,
        subTasks: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error("Error fetching task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    // Verify ownership
    const existingTask = await prisma.task.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const {
      title,
      description,
      status,
      categoryId,
      scheduledDate,
      scheduledTime,
      plannedMinutes,
      actualMinutes,
      priority,
      orderInDay,
      goalId,
      sprintId,
    } = body

    const updateData: Record<string, unknown> = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (status !== undefined) {
      updateData.status = status
      if (status === "DONE" && !existingTask.completedAt) {
        updateData.completedAt = new Date()
      }
    }
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (scheduledDate !== undefined)
      updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null
    if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime
    if (plannedMinutes !== undefined) updateData.plannedMinutes = plannedMinutes
    if (actualMinutes !== undefined) updateData.actualMinutes = actualMinutes
    if (priority !== undefined) updateData.priority = priority
    if (orderInDay !== undefined) updateData.orderInDay = orderInDay
    if (goalId !== undefined) updateData.goalId = goalId
    if (sprintId !== undefined) updateData.sprintId = sprintId

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const existingTask = await prisma.task.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    await prisma.task.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
