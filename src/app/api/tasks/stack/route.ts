import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// GET - Get task stack (unscheduled assigned tasks) grouped by sprint goals
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") as "WORK" | "PRIVATE" | null

    // Fix: Update any goal tasks that don't have assignedToId set (migration for old tasks)
    await prisma.task.updateMany({
      where: {
        goalId: { not: null },
        assignedToId: null,
        userId: session.user.id
      },
      data: {
        assignedToId: session.user.id
      }
    })

    const now = new Date()

    // Find active sprint for current user
    const activeSprint = await prisma.sprint.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        isActive: true,
        // Sprint belongs to user's goals
        goals: {
          some: {
            userId: session.user.id
          }
        }
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true
      }
    })

    // Base filter for unscheduled, incomplete tasks assigned to user
    const baseWhere: Prisma.TaskWhereInput = {
      assignedToId: session.user.id,
      scheduledDate: null,
      status: { not: "COMPLETED" },
      ...(workspace ? { workspaceType: workspace } : {})
    }

    // Get goals for active sprint with their tasks
    let goalGroups: Array<{
      goal: { id: string; title: string; category?: { id: string; name: string; color: string } | null }
      tasks: Array<unknown>
    }> = []

    if (activeSprint) {
      // Get goals for active sprint belonging to current user
      const sprintGoals = await prisma.goal.findMany({
        where: {
          sprintId: activeSprint.id,
          userId: session.user.id
        },
        select: {
          id: true,
          title: true,
          category: { select: { id: true, name: true, color: true } }
        },
        orderBy: { createdAt: "asc" }
      })

      // For each goal, get its unscheduled tasks
      for (const goal of sprintGoals) {
        const goalTasks = await prisma.task.findMany({
          where: {
            ...baseWhere,
            goalId: goal.id
          },
          include: {
            category: { select: { id: true, name: true, color: true } },
            user: { select: { id: true, name: true, email: true } },
            organization: { select: { id: true, name: true } },
            subtasks: { orderBy: { order: "asc" } }
          },
          orderBy: [
            { priority: "desc" },
            { createdAt: "asc" }
          ]
        })

        // Only add goal group if it has tasks
        if (goalTasks.length > 0) {
          goalGroups.push({
            goal: {
              id: goal.id,
              title: goal.title,
              category: goal.category
            },
            tasks: goalTasks
          })
        }
      }
    }

    // Get goal IDs that are in active sprint
    const sprintGoalIds = goalGroups.map(g => g.goal.id)

    // Get other tasks (only tasks WITHOUT any goal - simple assigned tasks)
    const otherTasks = await prisma.task.findMany({
      where: {
        ...baseWhere,
        goalId: null
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
        subtasks: { orderBy: { order: "asc" } }
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" }
      ]
    })

    return NextResponse.json({
      sprint: activeSprint,
      goalGroups,
      otherTasks
    })
  } catch (error) {
    console.error("Error fetching task stack:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
