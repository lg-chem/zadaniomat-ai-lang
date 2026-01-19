import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Helper function to check if user can access a task (owner, assigned, or team admin)
async function canAccessTask(taskId: string, userId: string) {
  // First check if user owns or is assigned to the task
  const ownTask = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [
        { userId },
        { assignedToId: userId }
      ]
    }
  })
  if (ownTask) return ownTask

  // Check if user is team owner and task belongs to their team member
  const task = await prisma.task.findFirst({
    where: { id: taskId }
  })
  if (!task) return null

  // Check if task owner is a member of a team where current user is OWNER
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: task.userId,
      role: "MEMBER",
      organization: {
        ownerId: userId,
      },
    },
  })

  if (membership) return task
  return null
}

// GET all subtasks for a task
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

    // Verify user has access to the task (owner, assigned, or team admin)
    const task = await canAccessTask(id, session.user.id)

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const subtasks = await prisma.subtask.findMany({
      where: { taskId: id },
      orderBy: { order: "asc" }
    })

    return NextResponse.json(subtasks)
  } catch (error) {
    console.error("Error fetching subtasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST create a new subtask
export async function POST(
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
    const { title } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 })
    }

    // Verify user has access to the task (owner, assigned, or team admin)
    const task = await canAccessTask(id, session.user.id)

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Get max order for this task's subtasks
    const maxOrder = await prisma.subtask.aggregate({
      where: { taskId: id },
      _max: { order: true }
    })

    const subtask = await prisma.subtask.create({
      data: {
        title: title.trim(),
        taskId: id,
        order: (maxOrder._max.order ?? -1) + 1
      }
    })

    return NextResponse.json(subtask, { status: 201 })
  } catch (error) {
    console.error("Error creating subtask:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PUT reorder subtasks
export async function PUT(
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
    const { subtaskIds } = body

    if (!Array.isArray(subtaskIds)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }

    // Verify user has access to the task (owner, assigned, or team admin)
    const task = await canAccessTask(id, session.user.id)

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Update order for each subtask
    await Promise.all(
      subtaskIds.map((subtaskId: string, index: number) =>
        prisma.subtask.update({
          where: { id: subtaskId },
          data: { order: index }
        })
      )
    )

    const subtasks = await prisma.subtask.findMany({
      where: { taskId: id },
      orderBy: { order: "asc" }
    })

    return NextResponse.json(subtasks)
  } catch (error) {
    console.error("Error reordering subtasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
