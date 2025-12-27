import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { startDate, endDate, name, targetValue } = body

    const existing = await prisma.challenge.findFirst({
      where: { id, userId: session.user.id },
      include: { milestones: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    // Create a copy of the challenge with optional overrides
    const newChallenge = await prisma.challenge.create({
      data: {
        name: name || existing.name,
        description: existing.description,
        challengeType: existing.challengeType,
        startDate: startDate ? new Date(startDate) : existing.startDate,
        endDate: endDate ? new Date(endDate) : existing.endDate,
        targetValue: targetValue ? parseFloat(targetValue) : existing.targetValue,
        currentValue: 0,
        unit: existing.unit,
        weeklyTarget: existing.weeklyTarget,
        isCompleted: false,
        color: existing.color,
        userId: session.user.id,
        // Copy milestones too
        milestones: existing.milestones.length > 0
          ? {
              create: existing.milestones.map((m) => ({
                name: m.name,
                targetValue: m.targetValue,
                isReached: false,
              })),
            }
          : undefined,
      },
      include: {
        milestones: true,
        entries: true,
      },
    })

    return NextResponse.json(newChallenge, { status: 201 })
  } catch (error) {
    console.error("Error copying challenge:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
