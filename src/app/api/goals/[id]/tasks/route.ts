import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Helper function to check if user can access a goal (owner or team admin)
async function canAccessGoal(goalId: string, userId: string) {
  // First check if user owns the goal
  const ownGoal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    include: { category: true },
  })
  if (ownGoal) return ownGoal

  // Check if user is team owner and goal belongs to their team member
  const goal = await prisma.goal.findFirst({
    where: { id: goalId },
    include: { category: true },
  })
  if (!goal) return null

  // Check if goal owner is a member of a team where current user is OWNER
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: goal.userId,
      role: "MEMBER",
      organization: {
        ownerId: userId,
      },
    },
  })

  if (membership) return goal
  return null
}

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

    // Verify goal exists and user has access (owner or team admin)
    const goal = await canAccessGoal(goalId, session.user.id)

    if (!goal) {
      return NextResponse.json({ error: "Cel nie znaleziony" }, { status: 404 })
    }

    // Get ALL tasks for this goal (both scheduled and unscheduled)
    const tasks = await prisma.task.findMany({
      where: {
        goalId,
        userId: goal.userId,
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

    // Verify goal exists and user has access (owner or team admin)
    const goal = await canAccessGoal(goalId, session.user.id)

    if (!goal) {
      return NextResponse.json({ error: "Cel nie znaleziony" }, { status: 404 })
    }

    // Create task linked to the goal (owned by goal owner)
    // Set assignedToId so it appears in goal owner's task-stack
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        plannedMinutes: plannedMinutes || null,
        status: "NEW",
        priority: 0,
        userId: goal.userId,
        assignedToId: goal.userId, // Appears in task-stack for scheduling
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
