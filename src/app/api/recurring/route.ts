import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isValidDay, toDayString } from "@/lib/calendar"
import { anchorRecurrence, nextOccurrences, parseTaskRecurrence, serializeTaskRecurrence } from "@/lib/task-recurrence"
import { loadRecurrenceContext, utcTodayString } from "@/lib/recurring-tasks"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = (searchParams.get("workspace") || "WORK") as "WORK" | "PRIVATE"

    const tasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace,
        isRecurring: true,
        recurrenceRule: { not: null },
      },
      include: {
        category: true,
      },
      orderBy: [
        { recurrenceRule: "asc" },
        { createdAt: "asc" },
      ],
    })

    // Next days each task will show up in the schedule, and the day its rule counts from
    const context = await loadRecurrenceContext(
      session.user.id,
      workspace,
      tasks.map((task) => task.recurrenceRule)
    )
    const today = utcTodayString()
    const withDates = tasks.map((task) => {
      const taskDay = task.scheduledDate ? toDayString(task.scheduledDate) : today
      const recurrence = parseTaskRecurrence(task.recurrenceRule, taskDay)
      return {
        ...task,
        startDate: recurrence?.anchor ?? taskDay,
        nextDates: recurrence
          ? nextOccurrences(recurrence, taskDay > today ? taskDay : today, 5, context)
          : [],
      }
    })

    return NextResponse.json(withDates)
  } catch (error) {
    console.error("Error fetching recurring tasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      title,
      description,
      recurrenceRule,
      scheduledTime,
      plannedMinutes,
      priority,
      categoryId,
      startDate,
    } = body
    const workspace = body.workspace === "PRIVATE" ? "PRIVATE" : "WORK"

    if (!title || !recurrenceRule) {
      return NextResponse.json(
        { error: "Tytuł i reguła powtarzania są wymagane" },
        { status: 400 }
      )
    }

    // The rule counts from the start day (today by default); the task itself is
    // put on the first day it falls on, not on today
    const today = utcTodayString()
    const start = isValidDay(startDate) ? startDate : today
    const recurrence = parseTaskRecurrence(recurrenceRule, start)
    if (!recurrence) {
      return NextResponse.json({ error: "Nieprawidłowa reguła powtarzania" }, { status: 400 })
    }
    const context = await loadRecurrenceContext(session.user.id, workspace, [recurrenceRule])
    const { recurrence: anchored, firstDay } = anchorRecurrence(recurrence, start, context, today)

    const task = await prisma.task.create({
      data: {
        title,
        description,
        descriptionUpdatedAt: description ? new Date() : null,
        isRecurring: true,
        recurrenceRule: serializeTaskRecurrence(anchored),
        scheduledDate: new Date(`${firstDay}T00:00:00.000Z`),
        scheduledTime,
        plannedMinutes,
        priority: priority || 0,
        categoryId: categoryId || null,
        workspaceType: workspace,
        userId: session.user.id,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Error creating recurring task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
