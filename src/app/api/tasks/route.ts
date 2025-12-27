import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") || "WORK"
    const date = searchParams.get("date")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
    const categoryId = searchParams.get("categoryId")

    const where: Record<string, unknown> = {
      userId: session.user.id,
      workspaceType: workspace,
    }

    if (date) {
      where.scheduledDate = new Date(date)
    } else if (startDate && endDate) {
      where.scheduledDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    if (status) {
      where.status = status
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        category: true,
        goal: {
          select: { id: true, title: true },
        },
        timeEntries: {
          orderBy: { startTime: "desc" },
          take: 5,
        },
      },
      orderBy: [
        { scheduledTime: "asc" },
        { orderInDay: "asc" },
        { createdAt: "desc" },
      ],
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching tasks:", error)
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
      categoryId,
      scheduledDate,
      scheduledTime,
      plannedMinutes,
      priority,
      workspaceType = "WORK",
      goalId,
      sprintId,
      orderInDay,
      status,
      isRecurring,
      recurrenceRule,
    } = body

    if (!title) {
      return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        categoryId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime,
        plannedMinutes,
        priority: priority || 0,
        workspaceType,
        goalId,
        sprintId,
        orderInDay: orderInDay || 0,
        status: status || "NEW",
        isRecurring: isRecurring || false,
        recurrenceRule: recurrenceRule || null,
        userId: session.user.id,
      },
      include: {
        category: true,
        goal: {
          select: { id: true, title: true },
        },
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
