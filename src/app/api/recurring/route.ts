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

    return NextResponse.json(tasks)
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
      workspace = "WORK",
    } = body

    if (!title || !recurrenceRule) {
      return NextResponse.json(
        { error: "Tytuł i reguła powtarzania są wymagane" },
        { status: 400 }
      )
    }

    // For recurring tasks, set scheduledDate to today as a starting point
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const task = await prisma.task.create({
      data: {
        title,
        description,
        isRecurring: true,
        recurrenceRule,
        scheduledDate: today,
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
