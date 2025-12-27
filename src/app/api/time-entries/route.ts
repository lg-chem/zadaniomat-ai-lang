import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { taskId, duration, notes } = body

    if (!taskId || duration === undefined) {
      return NextResponse.json(
        { error: "TaskId and duration are required" },
        { status: 400 }
      )
    }

    // Verify task belongs to user
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId: session.user.id },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Create time entry
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - duration * 60 * 1000)

    const timeEntry = await prisma.timeEntry.create({
      data: {
        taskId,
        startTime,
        endTime,
        duration,
        notes,
      },
    })

    return NextResponse.json(timeEntry, { status: 201 })
  } catch (error) {
    console.error("Error creating time entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get("taskId")
    const date = searchParams.get("date")

    const where: Record<string, unknown> = {
      task: { userId: session.user.id },
    }

    if (taskId) {
      where.taskId = taskId
    }

    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      }
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where,
      include: {
        task: {
          select: { id: true, title: true, category: true },
        },
      },
      orderBy: { startTime: "desc" },
    })

    return NextResponse.json(timeEntries)
  } catch (error) {
    console.error("Error fetching time entries:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
