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

    const where: Record<string, unknown> = {
      userId: session.user.id,
      workspaceType: workspace,
    }

    if (periodId) where.periodId = periodId
    if (sprintId) where.sprintId = sprintId

    const goals = await prisma.goal.findMany({
      where,
      include: {
        category: true,
        period: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
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
    } = body

    if (!title) {
      return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 })
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
        userId: session.user.id,
      },
      include: {
        category: true,
        period: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    console.error("Error creating goal:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
