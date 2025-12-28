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

    const periods = await prisma.period.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
      },
      include: {
        sprints: {
          orderBy: { startDate: "asc" },
          include: {
            goals: {
              include: {
                category: {
                  select: { id: true, name: true, color: true },
                },
              },
            },
            _count: {
              select: { goals: true },
            },
          },
        },
        goals: {
          include: {
            category: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        _count: {
          select: { sprints: true, goals: true },
        },
      },
      orderBy: { startDate: "desc" },
    })

    // Calculate task counts for each sprint based on scheduledDate within date range
    const periodsWithTaskCounts = await Promise.all(
      periods.map(async (period) => {
        const sprintsWithTaskCounts = await Promise.all(
          period.sprints.map(async (sprint) => {
            // Count tasks where scheduledDate is within sprint date range
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

        return {
          ...period,
          sprints: sprintsWithTaskCounts,
        }
      })
    )

    return NextResponse.json(periodsWithTaskCounts)
  } catch (error) {
    console.error("Error fetching periods:", error)
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
    const { name, startDate, endDate, workspaceType = "WORK" } = body

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Nazwa, data rozpoczęcia i zakończenia są wymagane" },
        { status: 400 }
      )
    }

    const period = await prisma.period.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        workspaceType,
        userId: session.user.id,
      },
      include: {
        sprints: true,
        _count: {
          select: { sprints: true, goals: true },
        },
      },
    })

    return NextResponse.json(period, { status: 201 })
  } catch (error) {
    console.error("Error creating period:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
