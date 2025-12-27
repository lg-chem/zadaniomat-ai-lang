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
    const { value, date, notes } = body

    const challenge = await prisma.challenge.findFirst({
      where: { id, userId: session.user.id },
      include: { milestones: true },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    const entryDate = date ? new Date(date) : new Date()
    entryDate.setHours(0, 0, 0, 0)

    // Create entry
    const entry = await prisma.challengeEntry.create({
      data: {
        challengeId: id,
        value: parseFloat(value),
        date: entryDate,
        notes,
      },
    })

    // Update challenge progress
    const newCurrentValue = challenge.currentValue + parseFloat(value)
    const isCompleted = newCurrentValue >= challenge.targetValue

    await prisma.challenge.update({
      where: { id },
      data: {
        currentValue: newCurrentValue,
        isCompleted,
      },
    })

    // Check and update milestones
    for (const milestone of challenge.milestones) {
      if (!milestone.isReached && newCurrentValue >= milestone.targetValue) {
        await prisma.challengeMilestone.update({
          where: { id: milestone.id },
          data: {
            isReached: true,
            reachedAt: new Date(),
          },
        })
      }
    }

    return NextResponse.json({
      entry,
      currentValue: newCurrentValue,
      isCompleted,
    })
  } catch (error) {
    console.error("Error adding entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
