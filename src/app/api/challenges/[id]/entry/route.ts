import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { startOfWeek, differenceInWeeks } from "date-fns"

// Calculate completed weeks for WEEKLY_HABIT challenges
// Returns the number of weeks where user completed >= weeklyTarget entries
function calculateCompletedWeeks(
  entries: { date: Date; value: number }[],
  startDate: Date,
  weeklyTarget: number
): number {
  if (entries.length === 0 || weeklyTarget <= 0) return 0

  // Group entries by week number (relative to challenge start)
  const weekMap = new Map<number, number>()

  const challengeStartWeek = startOfWeek(startDate, { weekStartsOn: 1 }) // Monday

  for (const entry of entries) {
    const entryDate = new Date(entry.date)
    const weekNumber = differenceInWeeks(
      startOfWeek(entryDate, { weekStartsOn: 1 }),
      challengeStartWeek
    )

    // Only count weeks that are >= 0 (after or at start)
    if (weekNumber >= 0) {
      const currentCount = weekMap.get(weekNumber) || 0
      weekMap.set(weekNumber, currentCount + entry.value)
    }
  }

  // Count weeks where entries >= weeklyTarget
  let completedWeeks = 0
  for (const count of weekMap.values()) {
    if (count >= weeklyTarget) {
      completedWeeks++
    }
  }

  return completedWeeks
}

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

        // Calculate new progress
        let newCurrentValue: number
        if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
          // For WEEKLY_HABIT: recalculate completed weeks
          const remainingEntries = challenge.entries.filter(e => e.id !== existingEntry.id)
          newCurrentValue = calculateCompletedWeeks(
            remainingEntries,
            challenge.startDate,
            challenge.weeklyTarget
          )
        } else {
          // For other types: decrease by entry value
          newCurrentValue = Math.max(0, challenge.currentValue - existingEntry.value)
        }

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

    // Calculate new progress
    let newCurrentValue: number
    if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
      // For WEEKLY_HABIT: recalculate completed weeks including new entry
      const allEntries = [...challenge.entries, { date: entryDate, value: parseFloat(value) }]
      newCurrentValue = calculateCompletedWeeks(
        allEntries,
        challenge.startDate,
        challenge.weeklyTarget
      )
    } else {
      // For other types: add entry value
      newCurrentValue = challenge.currentValue + parseFloat(value)
    }

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

// Update entry
export async function PATCH(
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
    const { entryId, value, notes } = body

    const challenge = await prisma.challenge.findFirst({
      where: { id, userId: session.user.id },
      include: { entries: true },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    const entry = await prisma.challengeEntry.findFirst({
      where: { id: entryId, challengeId: id },
    })

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const oldValue = entry.value
    const newValue = parseFloat(value)
    const valueDiff = newValue - oldValue

    // Update entry
    await prisma.challengeEntry.update({
      where: { id: entryId },
      data: {
        value: newValue,
        notes,
      },
    })

    // Calculate new progress
    let newCurrentValue: number
    if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
      // For WEEKLY_HABIT: recalculate completed weeks with updated entry value
      const updatedEntries = challenge.entries.map(e =>
        e.id === entryId ? { ...e, value: newValue } : e
      )
      newCurrentValue = calculateCompletedWeeks(
        updatedEntries,
        challenge.startDate,
        challenge.weeklyTarget
      )
    } else {
      // For other types: add difference
      newCurrentValue = challenge.currentValue + valueDiff
    }

    await prisma.challenge.update({
      where: { id },
      data: {
        currentValue: newCurrentValue,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Delete entry
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const { searchParams } = new URL(req.url)
    const entryId = searchParams.get("entryId")

    if (!entryId) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 })
    }

    const challenge = await prisma.challenge.findFirst({
      where: { id, userId: session.user.id },
      include: { entries: true },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    const entry = await prisma.challengeEntry.findFirst({
      where: { id: entryId, challengeId: id },
    })

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    // Delete entry
    await prisma.challengeEntry.delete({
      where: { id: entryId },
    })

    // Calculate new progress
    let newCurrentValue: number
    if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
      // For WEEKLY_HABIT: recalculate completed weeks without deleted entry
      const remainingEntries = challenge.entries.filter(e => e.id !== entryId)
      newCurrentValue = calculateCompletedWeeks(
        remainingEntries,
        challenge.startDate,
        challenge.weeklyTarget
      )
    } else {
      // For other types: decrease by entry value
      newCurrentValue = Math.max(0, challenge.currentValue - entry.value)
    }

    await prisma.challenge.update({
      where: { id },
      data: {
        currentValue: newCurrentValue,
        isCompleted: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
