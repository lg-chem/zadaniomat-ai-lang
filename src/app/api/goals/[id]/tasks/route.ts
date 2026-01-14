import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Get tasks for a specific goal (unscheduled tasks)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: goalId } = await params

    // Verify goal belongs to user
    const goal = await prisma.goal.findFirst({
      where: {
        id: goalId,
        userId: session.user.id,
      },
    })

    if (!goal) {
      return NextResponse.json({ error: "Cel nie znaleziony" }, { status: 404 })
    }

    // Get ALL tasks for this goal (both scheduled and unscheduled)
    const tasks = await prisma.task.findMany({
      where: {
        goalId,
        userId: session.user.id,
      },
      include: {
        category: true,
        subtasks: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching goal tasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Create a new task for a goal
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: goalId } = await params
    const { title, description, plannedMinutes } = await req.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 })
    }

    // Verify goal belongs to user and get its category
    const goal = await prisma.goal.findFirst({
      where: {
        id: goalId,
        userId: session.user.id,
      },
      include: {
        category: true,
      },
    })

    if (!goal) {
      return NextResponse.json({ error: "Cel nie znaleziony" }, { status: 404 })
    }

    // Create task linked to the goal
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        plannedMinutes: plannedMinutes || null,
        status: "NEW",
        priority: 0,
        userId: session.user.id,
        goalId,
        categoryId: goal.categoryId,
        workspaceType: goal.category?.workspaceType || "WORK",
      },
      include: {
        category: true,
        subtasks: {
          orderBy: { order: "asc" },
        },
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Error creating goal task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
