import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { startOfWeek, differenceInWeeks } from "date-fns"

// Calculate completed weeks for WEEKLY_HABIT challenges
function calculateCompletedWeeks(
  entries: { date: Date; value: number }[],
  startDate: Date,
  weeklyTarget: number
): number {
  if (entries.length === 0 || weeklyTarget <= 0) return 0

  const weekMap = new Map<number, number>()
  const challengeStartWeek = startOfWeek(startDate, { weekStartsOn: 1 })

  for (const entry of entries) {
    const entryDate = new Date(entry.date)
    const weekNumber = differenceInWeeks(
      startOfWeek(entryDate, { weekStartsOn: 1 }),
      challengeStartWeek
    )

    if (weekNumber >= 0) {
      const currentCount = weekMap.get(weekNumber) || 0
      weekMap.set(weekNumber, currentCount + entry.value)
    }
  }

  let completedWeeks = 0
  for (const count of weekMap.values()) {
    if (count >= weeklyTarget) {
      completedWeeks++
    }
  }

  return completedWeeks
}

// POST - Add entry for current user
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { value, date, notes, toggle } = body

    // Get challenge and user's membership
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    const membership = await prisma.groupChallengeMember.findUnique({
      where: {
        challengeId_userId: {
          challengeId: id,
          userId: session.user.id,
        },
      },
      include: {
        entries: true,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Nie jesteś członkiem tego wyzwania" },
        { status: 403 }
      )
    }

    const entryDate = date ? new Date(date) : new Date()
    entryDate.setHours(0, 0, 0, 0)
    const entryDateStr = entryDate.toISOString().split("T")[0]

    // For toggle mode (weekly habits, monthly goals), check if entry exists
    if (toggle) {
      const existingEntry = membership.entries.find((e) => {
        const eDate = new Date(e.date).toISOString().split("T")[0]
        return eDate === entryDateStr
      })

      if (existingEntry) {
        // Delete entry
        await prisma.groupChallengeEntry.delete({
          where: { id: existingEntry.id },
        })

        // Calculate new progress
        let newCurrentValue: number
        if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
          const remainingEntries = membership.entries.filter(
            (e) => e.id !== existingEntry.id
          )
          newCurrentValue = calculateCompletedWeeks(
            remainingEntries,
            challenge.startDate,
            challenge.weeklyTarget
          )
        } else {
          newCurrentValue = Math.max(0, membership.currentValue - existingEntry.value)
        }

        await prisma.groupChallengeMember.update({
          where: { id: membership.id },
          data: {
            currentValue: newCurrentValue,
            isCompleted: false,
          },
        })

        return NextResponse.json({
          toggled: "off",
          currentValue: newCurrentValue,
        })
      }
    }

    // Create entry
    const entry = await prisma.groupChallengeEntry.create({
      data: {
        memberId: membership.id,
        value: parseFloat(value),
        date: entryDate,
        notes,
      },
    })

    // Calculate new progress
    let newCurrentValue: number
    if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
      const allEntries = [
        ...membership.entries,
        { date: entryDate, value: parseFloat(value) },
      ]
      newCurrentValue = calculateCompletedWeeks(
        allEntries,
        challenge.startDate,
        challenge.weeklyTarget
      )
    } else {
      newCurrentValue = membership.currentValue + parseFloat(value)
    }

    const shouldAutoComplete =
      challenge.challengeType !== "NUMERIC" &&
      newCurrentValue >= challenge.targetValue

    await prisma.groupChallengeMember.update({
      where: { id: membership.id },
      data: {
        currentValue: newCurrentValue,
        ...(shouldAutoComplete && { isCompleted: true }),
      },
    })

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

// PATCH - Update entry
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { entryId, value, notes } = body

    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    const membership = await prisma.groupChallengeMember.findUnique({
      where: {
        challengeId_userId: {
          challengeId: id,
          userId: session.user.id,
        },
      },
      include: {
        entries: true,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Nie jesteś członkiem tego wyzwania" },
        { status: 403 }
      )
    }

    const entry = membership.entries.find((e) => e.id === entryId)

    if (!entry) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    const oldValue = entry.value
    const newValue = parseFloat(value)
    const valueDiff = newValue - oldValue

    await prisma.groupChallengeEntry.update({
      where: { id: entryId },
      data: {
        value: newValue,
        notes,
      },
    })

    // Calculate new progress
    let newCurrentValue: number
    if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
      const updatedEntries = membership.entries.map((e) =>
        e.id === entryId ? { ...e, value: newValue } : e
      )
      newCurrentValue = calculateCompletedWeeks(
        updatedEntries,
        challenge.startDate,
        challenge.weeklyTarget
      )
    } else {
      newCurrentValue = membership.currentValue + valueDiff
    }

    await prisma.groupChallengeMember.update({
      where: { id: membership.id },
      data: {
        currentValue: newCurrentValue,
      },
    })

    return NextResponse.json({ success: true, currentValue: newCurrentValue })
  } catch (error) {
    console.error("Error updating entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - Delete entry
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const entryId = searchParams.get("entryId")

    if (!entryId) {
      return NextResponse.json({ error: "Wymagane ID wpisu" }, { status: 400 })
    }

    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    const membership = await prisma.groupChallengeMember.findUnique({
      where: {
        challengeId_userId: {
          challengeId: id,
          userId: session.user.id,
        },
      },
      include: {
        entries: true,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Nie jesteś członkiem tego wyzwania" },
        { status: 403 }
      )
    }

    const entry = membership.entries.find((e) => e.id === entryId)

    if (!entry) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    await prisma.groupChallengeEntry.delete({
      where: { id: entryId },
    })

    // Calculate new progress
    let newCurrentValue: number
    if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
      const remainingEntries = membership.entries.filter((e) => e.id !== entryId)
      newCurrentValue = calculateCompletedWeeks(
        remainingEntries,
        challenge.startDate,
        challenge.weeklyTarget
      )
    } else {
      newCurrentValue = Math.max(0, membership.currentValue - entry.value)
    }

    await prisma.groupChallengeMember.update({
      where: { id: membership.id },
      data: {
        currentValue: newCurrentValue,
        isCompleted: false,
      },
    })

    return NextResponse.json({ success: true, currentValue: newCurrentValue })
  } catch (error) {
    console.error("Error deleting entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
