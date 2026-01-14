import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

interface StepInput {
  title: string
  description?: string
}

// Helper function to check if user can access a goal (owner or team admin)
async function canAccessGoal(goalId: string, userId: string) {
  // First check if user owns the goal
  const ownGoal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    include: { period: true },
  })
  if (ownGoal) return ownGoal

  // Check if user is team owner and goal belongs to their team member
  const goal = await prisma.goal.findFirst({
    where: { id: goalId },
    include: { period: true },
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

// POST - Create implementation steps for a goal
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: parentGoalId } = params
    const body = await req.json()
    const { steps } = body as { steps: StepInput[] }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: "Steps array is required" }, { status: 400 })
    }

    // Verify parent goal exists and user has access (owner or team admin)
    const parentGoal = await canAccessGoal(parentGoalId, session.user.id)

    if (!parentGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    // Get current max order for existing child goals
    const maxOrderResult = await prisma.goal.aggregate({
      where: { parentGoalId },
      _max: { order: true },
    })
    const startOrder = (maxOrderResult._max.order ?? -1) + 1

    // Create steps as child goals
    const createdSteps = await prisma.$transaction(
      steps.map((step, index) =>
        prisma.goal.create({
          data: {
            title: step.title,
            description: step.description || null,
            isStep: true,
            order: startOrder + index,
            workspaceType: parentGoal.workspaceType,
            userId: parentGoal.userId,
            categoryId: parentGoal.categoryId,
            periodId: parentGoal.periodId,
            parentGoalId: parentGoalId,
          },
          include: {
            category: true,
          },
        })
      )
    )

    // Update parent goal's targetValue to track step completion
    const totalSteps = await prisma.goal.count({
      where: { parentGoalId },
    })

    await prisma.goal.update({
      where: { id: parentGoalId },
      data: {
        targetValue: totalSteps,
        unit: "kroków",
      },
    })

    return NextResponse.json({
      steps: createdSteps,
      message: `Utworzono ${createdSteps.length} kroków realizacji`
    })
  } catch (error) {
    console.error("Error creating steps:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// GET - Get all steps (child goals) for a goal
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: parentGoalId } = params

    // Verify parent goal exists and user has access (owner or team admin)
    const parentGoal = await canAccessGoal(parentGoalId, session.user.id)

    if (!parentGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    const steps = await prisma.goal.findMany({
      where: {
        parentGoalId,
        isStep: true,
      },
      include: {
        category: true,
        sprint: { select: { id: true, name: true } },
        tasks: {
          select: { id: true, status: true },
        },
      },
      orderBy: { order: "asc" },
    })

    // Calculate progress for each step based on its tasks
    const stepsWithProgress = steps.map(step => {
      const totalTasks = step.tasks.length
      const completedTasks = step.tasks.filter(t => t.status === "COMPLETED").length

      return {
        ...step,
        tasks: undefined, // Don't expose full task list
        taskProgress: {
          total: totalTasks,
          completed: completedTasks,
          percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
      }
    })

    return NextResponse.json(stepsWithProgress)
  } catch (error) {
    console.error("Error fetching steps:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
