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
    const periodId = searchParams.get("periodId")
    const workspace = searchParams.get("workspace") || "WORK"
    const active = searchParams.get("active")

    const where: Record<string, unknown> = {
      period: {
        userId: session.user.id,
        workspaceType: workspace,
      },
    }

    if (periodId) {
      where.periodId = periodId
    }

    if (active === "true") {
      where.isActive = true
    }

    const sprints = await prisma.sprint.findMany({
      where,
      include: {
        period: {
          select: { id: true, name: true },
        },
        goals: {
          include: {
            category: true,
          },
        },
        _count: {
          select: { goals: true },
        },
      },
      orderBy: { startDate: "desc" },
    })

    // Calculate task counts based on scheduledDate within sprint date range
    const sprintsWithTaskCounts = await Promise.all(
      sprints.map(async (sprint) => {
        const taskCount = await prisma.task.count({
          where: {
            userId: session.user.id,
            workspaceType: workspace as "WORK" | "PRIVATE",
            scheduledDate: {
              gte: sprint.startDate,
              lte: sprint.endDate,
            },
          },
        })

        return {
          ...sprint,
          _count: {
            ...sprint._count,
            tasks: taskCount,
          },
        }
      })
    )

    return NextResponse.json(sprintsWithTaskCounts)
  } catch (error) {
    console.error("Error fetching sprints:", error)
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
    const { name, startDate, endDate, periodId } = body

    if (!name || !startDate || !endDate || !periodId) {
      return NextResponse.json(
        { error: "Nazwa, daty i okres są wymagane" },
        { status: 400 }
      )
    }

    // Verify period ownership
    const period = await prisma.period.findFirst({
      where: { id: periodId, userId: session.user.id },
    })

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 })
    }

    const sprint = await prisma.sprint.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        periodId,
      },
      include: {
        period: {
          select: { id: true, name: true },
        },
        _count: {
          select: { tasks: true, goals: true },
        },
      },
    })

    return NextResponse.json(sprint, { status: 201 })
  } catch (error) {
    console.error("Error creating sprint:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
