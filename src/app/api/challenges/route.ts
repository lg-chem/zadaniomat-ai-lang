import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { loadChallenges, readLinkFields } from "@/lib/challenge-data"

export const dynamic = "force-dynamic"

// GET - challenges with their entries; ?showCompleted=true adds the closed ones
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const showCompleted = searchParams.get("showCompleted") === "true"

    const challenges = await loadChallenges(session.user.id, { showCompleted })

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

    const link = await readLinkFields(session.user.id, body)
    if ("error" in link) {
      return NextResponse.json({ error: link.error }, { status: 400 })
    }

    const challenge = await prisma.challenge.create({
      data: {
        ...link.data,
        name,
        description,
        challengeType: challengeType || "NUMERIC",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        targetValue: parseFloat(targetValue),
        unit,
        weeklyTarget: weeklyTarget ? parseInt(weeklyTarget) : null,
        color: color || "#f59e0b",
        // Private unless shared on purpose
        isPublic: isPublic === true,
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
