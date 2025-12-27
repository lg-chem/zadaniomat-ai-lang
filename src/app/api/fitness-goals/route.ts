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
    const workspaceType = searchParams.get("workspaceType") || "PRIVATE"
    const periodId = searchParams.get("periodId")
    const includeActive = searchParams.get("includeActive") === "true"

    const where: Record<string, unknown> = {
      userId: session.user.id,
      workspaceType: workspaceType as "WORK" | "PRIVATE",
    }

    if (periodId) {
      where.periodId = periodId
    }

    if (includeActive) {
      // Only get goals where endDate is in the future
      where.endDate = {
        gte: new Date(),
      }
      where.isCompleted = false
    }

    const fitnessGoals = await prisma.fitnessGoal.findMany({
      where,
      include: {
        period: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    })

    return NextResponse.json(fitnessGoals)
  } catch (error) {
    console.error("Error fetching fitness goals:", error)
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
      name,
      description,
      goalType,
      targetValue,
      currentValue,
      unit,
      startDate,
      endDate,
      workspaceType,
      periodId,
    } = body

    if (!name || !goalType || !targetValue || !unit || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const fitnessGoal = await prisma.fitnessGoal.create({
      data: {
        name,
        description,
        goalType,
        targetValue: parseFloat(targetValue),
        currentValue: currentValue ? parseFloat(currentValue) : 0,
        unit,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        workspaceType: workspaceType || "PRIVATE",
        userId: session.user.id,
        periodId: periodId || null,
      },
      include: {
        period: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    })

    return NextResponse.json(fitnessGoal, { status: 201 })
  } catch (error) {
    console.error("Error creating fitness goal:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
