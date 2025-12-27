import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Helper to check if a task should occur on a given date based on recurrence rule
function shouldTaskOccurOnDate(
  task: { scheduledDate: Date | null; recurrenceRule: string | null },
  targetDate: Date
): boolean {
  if (!task.scheduledDate || !task.recurrenceRule) return false

  const startDate = new Date(task.scheduledDate)
  const target = new Date(targetDate)

  // Reset time parts for date comparison
  startDate.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)

  // If target is before start date, no occurrence
  if (target < startDate) return false

  const daysDiff = Math.floor((target.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  switch (task.recurrenceRule) {
    case "DAILY":
      return true // Every day after start
    case "WEEKLY":
      return daysDiff % 7 === 0 // Same day of week
    case "WEEKDAYS":
      const dayOfWeek = target.getDay()
      return dayOfWeek >= 1 && dayOfWeek <= 5 // Mon-Fri
    case "MONTHLY":
      return startDate.getDate() === target.getDate() // Same day of month
    default:
      return false
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { date, workspace = "WORK" } = body

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 })
    }

    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)

    // Get all recurring tasks for this user and workspace
    const recurringTasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace,
        isRecurring: true,
        recurrenceRule: { not: null },
        scheduledDate: { lte: targetDate },
      },
      include: {
        category: true,
      },
    })

    // Check which recurring tasks should occur on target date
    const tasksToGenerate = recurringTasks.filter((task) =>
      shouldTaskOccurOnDate(task, targetDate)
    )

    // Check which tasks already exist for this date (to avoid duplicates)
    const existingTasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace,
        scheduledDate: targetDate,
      },
      select: {
        title: true,
        categoryId: true,
        isRecurring: true,
      },
    })

    // Create new tasks for recurring ones that don't exist yet
    const createdTasks = []
    for (const task of tasksToGenerate) {
      // Check if a similar task already exists (same title, same category, or it's the original recurring task on its start date)
      const alreadyExists = existingTasks.some(
        (existing) =>
          existing.title === task.title &&
          existing.categoryId === task.categoryId
      )

      // Also skip if this is the original task's start date
      const isOriginalDate = task.scheduledDate &&
        new Date(task.scheduledDate).toDateString() === targetDate.toDateString()

      if (!alreadyExists && !isOriginalDate) {
        const newTask = await prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            categoryId: task.categoryId,
            scheduledDate: targetDate,
            scheduledTime: task.scheduledTime,
            plannedMinutes: task.plannedMinutes,
            priority: task.priority,
            workspaceType: workspace,
            goalId: task.goalId,
            orderInDay: existingTasks.length + createdTasks.length,
            status: "NEW",
            isRecurring: false, // Generated instances are not recurring themselves
            userId: session.user.id,
          },
          include: {
            category: true,
          },
        })
        createdTasks.push(newTask)
      }
    }

    return NextResponse.json({
      generated: createdTasks.length,
      tasks: createdTasks,
    })
  } catch (error) {
    console.error("Error generating recurring tasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
