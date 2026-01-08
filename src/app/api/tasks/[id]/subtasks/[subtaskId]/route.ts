import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// PATCH update a subtask (toggle completion, rename)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, subtaskId } = await params
    const body = await req.json()
    const { title, isCompleted } = body

    // Verify user has access to the task
    const task = await prisma.task.findFirst({
      where: {
        id,
        OR: [
          { userId: session.user.id },
          { assignedToId: session.user.id }
        ]
      }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Verify subtask belongs to the task
    const existingSubtask = await prisma.subtask.findFirst({
      where: {
        id: subtaskId,
        taskId: id
      }
    })

    if (!existingSubtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted

    const subtask = await prisma.subtask.update({
      where: { id: subtaskId },
      data: updateData
    })

    return NextResponse.json(subtask)
  } catch (error) {
    console.error("Error updating subtask:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE a subtask
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, subtaskId } = await params

    // Verify user has access to the task
    const task = await prisma.task.findFirst({
      where: {
        id,
        OR: [
          { userId: session.user.id },
          { assignedToId: session.user.id }
        ]
      }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Verify subtask belongs to the task
    const existingSubtask = await prisma.subtask.findFirst({
      where: {
        id: subtaskId,
        taskId: id
      }
    })

    if (!existingSubtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 })
    }

    await prisma.subtask.delete({
      where: { id: subtaskId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting subtask:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
