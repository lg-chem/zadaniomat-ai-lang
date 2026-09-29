import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isValidDay, toDayString } from "@/lib/calendar"
import { taskOccursOn } from "@/lib/task-recurrence"
import { loadRecurrenceContext } from "@/lib/recurring-tasks"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { date, workspace = "WORK" } = body

    if (!isValidDay(date)) {
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
    // (rules and dates as "yyyy-MM-dd", see lib/task-recurrence)
    const context = await loadRecurrenceContext(
      session.user.id,
      workspace === "PRIVATE" ? "PRIVATE" : "WORK",
      recurringTasks.map((task) => task.recurrenceRule)
    )
    const tasksToGenerate = recurringTasks.filter(
      (task) =>
        task.scheduledDate && taskOccursOn(task.recurrenceRule, toDayString(task.scheduledDate), date, context)
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
    const createdTasks: Array<{ id: string; title: string }> = []
    for (const task of tasksToGenerate) {
      // Check if a similar task already exists (same title, same category, or it's the original recurring task on its start date)
      const alreadyExists = existingTasks.some(
        (existing: typeof existingTasks[number]) =>
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
