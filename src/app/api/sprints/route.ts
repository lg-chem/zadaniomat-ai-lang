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
    const organizationId = searchParams.get("organizationId")

    const where: Record<string, unknown> = {}

    if (organizationId) {
      // Team sprints - check if user is member of org
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
        },
      })

      if (!membership) {
        return NextResponse.json({ error: "Brak dostępu do zespołu" }, { status: 403 })
      }

      where.organizationId = organizationId
      where.period = {
        workspaceType: workspace,
      }
    } else {
      // Check if user is MEMBER of any team (not owner) - if so, show team owner's sprints
      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          role: "MEMBER",
        },
        include: {
          organization: {
            select: { ownerId: true },
          },
        },
      })

      if (membership) {
        // User is employee - show team owner's sprints
        where.period = {
          userId: membership.organization.ownerId,
          workspaceType: workspace,
        }
      } else {
        // Personal sprints (user is not member of any team, or is owner)
        where.period = {
          userId: session.user.id,
          workspaceType: workspace,
        }
      }
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
    const { name, startDate, endDate, periodId, organizationId } = body

    if (!name || !startDate || !endDate || !periodId) {
      return NextResponse.json(
        { error: "Nazwa, daty i okres są wymagane" },
        { status: 400 }
      )
    }

    // Verify period access
    const period = await prisma.period.findFirst({
      where: { id: periodId },
    })

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 })
    }

    // If organizationId provided, verify user is OWNER
    if (organizationId) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
          role: "OWNER",
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "Tylko właściciel zespołu może tworzyć sprinty" },
          { status: 403 }
        )
      }
    } else {
      // Personal sprint - verify period ownership
      if (period.userId !== session.user.id) {
        return NextResponse.json({ error: "Brak dostępu do okresu" }, { status: 403 })
      }
    }

    const sprint = await prisma.sprint.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        periodId,
        organizationId: organizationId || null,
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
