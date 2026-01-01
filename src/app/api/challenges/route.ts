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
    const showCompleted = searchParams.get("showCompleted") === "true"

    // For active view, show both incomplete and those that exceeded target
    const challenges = await prisma.challenge.findMany({
      where: {
        userId: session.user.id,
        ...(showCompleted
          ? {}
          : {
              OR: [
                { isCompleted: false },
                // Also show completed challenges that exceeded target (for NUMERIC type)
                {
                  isCompleted: true,
                  challengeType: "NUMERIC",
                },
              ],
            }),
      },
      include: {
        milestones: {
          orderBy: { targetValue: "asc" },
        },
        entries: {
          orderBy: { date: "desc" },
        },
      },
      orderBy: { endDate: "asc" },
    })

    return NextResponse.json(challenges)
  } catch (error) {
    console.error("Error fetching challenges:", error)
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
    const { name, description, startDate, endDate, targetValue, unit, color, challengeType, weeklyTarget, isPublic } = body

    if (!name || !startDate || !endDate || !targetValue || !unit) {
      return NextResponse.json({ error: "Wymagane pola: nazwa, daty, cel, jednostka" }, { status: 400 })
    }

    // For weekly habits, weeklyTarget is required
    if (challengeType === "WEEKLY_HABIT" && !weeklyTarget) {
      return NextResponse.json({ error: "Dla nawyku tygodniowego wymagana jest liczba dni w tygodniu" }, { status: 400 })
    }

    const challenge = await prisma.challenge.create({
      data: {
        name,
        description,
        challengeType: challengeType || "NUMERIC",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        targetValue: parseFloat(targetValue),
        unit,
        weeklyTarget: weeklyTarget ? parseInt(weeklyTarget) : null,
        color: color || "#f59e0b",
        isPublic: isPublic || false,
        userId: session.user.id,
      },
      include: {
        milestones: true,
        entries: true,
      },
    })

    return NextResponse.json(challenge, { status: 201 })
  } catch (error) {
    console.error("Error creating challenge:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
