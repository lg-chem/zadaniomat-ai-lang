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
    const { value, date, notes, toggle } = body

    const challenge = await prisma.challenge.findFirst({
      where: { id, userId: session.user.id },
      include: { milestones: true, entries: true },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    const entryDate = date ? new Date(date) : new Date()
    entryDate.setHours(0, 0, 0, 0)
    const entryDateStr = entryDate.toISOString().split("T")[0]

    // For toggle mode (weekly habits, monthly goals), check if entry exists
    if (toggle) {
      const existingEntry = challenge.entries.find((e) => {
        const eDate = new Date(e.date).toISOString().split("T")[0]
        return eDate === entryDateStr
      })

      if (existingEntry) {
        // Delete entry
        await prisma.challengeEntry.delete({
          where: { id: existingEntry.id },
        })

        // Update challenge progress (decrease by entry value)
        const newCurrentValue = Math.max(0, challenge.currentValue - existingEntry.value)
        await prisma.challenge.update({
          where: { id },
          data: {
            currentValue: newCurrentValue,
            isCompleted: false, // Un-complete when removing
          },
        })

        return NextResponse.json({
          toggled: "off",
          currentValue: newCurrentValue,
        })
      }
    }

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
    // Don't auto-complete for NUMERIC - user might want to keep tracking
    // Only auto-complete for WEEKLY_HABIT and MONTHLY_GOAL when target reached
    const shouldAutoComplete = challenge.challengeType !== "NUMERIC" && newCurrentValue >= challenge.targetValue

    await prisma.challenge.update({
      where: { id },
      data: {
        currentValue: newCurrentValue,
        ...(shouldAutoComplete && { isCompleted: true }),
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
      toggled: "on",
      currentValue: newCurrentValue,
      isCompleted: shouldAutoComplete,
    })
  } catch (error) {
    console.error("Error adding entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
