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
    const periodId = searchParams.get("periodId")
    const sprintId = searchParams.get("sprintId")
    const organizationId = searchParams.get("organizationId")
    const targetUserId = searchParams.get("targetUserId") // Admin viewing employee's goals

    const where: Record<string, unknown> = {
      workspaceType: workspace,
    }

    if (organizationId && targetUserId) {
      // Admin viewing employee's goals in team context
      // Verify admin is owner of org
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
          role: "OWNER",
        },
      })

      if (!membership) {
        return NextResponse.json({ error: "Brak uprawnień administratora" }, { status: 403 })
      }

      // Verify target user is member of org
      const targetMembership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: targetUserId,
        },
      })

      if (!targetMembership) {
        return NextResponse.json({ error: "Użytkownik nie jest członkiem zespołu" }, { status: 403 })
      }

      where.userId = targetUserId
      where.organizationId = organizationId
    } else if (organizationId) {
      // User viewing their own goals in team context
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
        },
      })

      if (!membership) {
        return NextResponse.json({ error: "Brak dostępu do zespołu" }, { status: 403 })
      }

      where.userId = session.user.id
      where.organizationId = organizationId
    } else {
      // Personal goals (no org context)
      where.userId = session.user.id
      where.organizationId = null
    }

    if (periodId) where.periodId = periodId
    if (sprintId) where.sprintId = sprintId

    const goals = await prisma.goal.findMany({
      where,
      include: {
        category: true,
        period: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(goals)
  } catch (error) {
    console.error("Error fetching goals:", error)
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
      targetValue,
      unit,
      categoryId,
      periodId,
      sprintId,
      workspaceType = "WORK",
      organizationId,
      targetUserId, // Admin creating goal for employee
    } = body

    if (!title) {
      return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 })
    }

    let goalUserId = session.user.id

    // If creating goal for another user (admin feature)
    if (organizationId && targetUserId) {
      // Verify admin is owner of org
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
          role: "OWNER",
        },
      })

      if (!membership) {
        return NextResponse.json({ error: "Brak uprawnień administratora" }, { status: 403 })
      }

      // Verify target user is member of org
      const targetMembership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: targetUserId,
        },
      })

      if (!targetMembership) {
        return NextResponse.json({ error: "Użytkownik nie jest członkiem zespołu" }, { status: 403 })
      }

      goalUserId = targetUserId
    } else if (organizationId) {
      // User creating their own goal in team context
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
        },
      })

      if (!membership) {
        return NextResponse.json({ error: "Brak dostępu do zespołu" }, { status: 403 })
      }
    }

    const goal = await prisma.goal.create({
      data: {
        title,
        description,
        targetValue: targetValue ? parseFloat(targetValue) : null,
        unit,
        categoryId,
        periodId,
        sprintId,
        workspaceType,
        userId: goalUserId,
        organizationId: organizationId || null,
      },
      include: {
        category: true,
        period: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    console.error("Error creating goal:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
