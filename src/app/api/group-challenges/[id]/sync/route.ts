import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { startOfDay, endOfDay, eachDayOfInterval, format, startOfWeek, differenceInWeeks } from "date-fns"

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

// POST - Sync data from linked source for current user
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

    // Get challenge and membership
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

    if (membership.linkedType === "NONE") {
      return NextResponse.json(
        { error: "Brak skonfigurowanej integracji" },
        { status: 400 }
      )
    }

    // Get date range for challenge
    const startDate = new Date(challenge.startDate)
    const endDate = new Date(challenge.endDate)
    const today = new Date()
    const effectiveEndDate = endDate < today ? endDate : today

    // Get all days in range
    const daysToCheck = eachDayOfInterval({
      start: startDate,
      end: effectiveEndDate,
    })

    // Existing entries dates
    const existingEntryDates = new Set(
      membership.entries.map((e) => format(new Date(e.date), "yyyy-MM-dd"))
    )

    let newEntriesCount = 0
    const newEntries: { date: Date; value: number }[] = []

    // Check each day based on linked type
    for (const day of daysToCheck) {
      const dayStr = format(day, "yyyy-MM-dd")

      // Skip if already has entry
      if (existingEntryDates.has(dayStr)) {
        continue
      }

      let shouldCreateEntry = false

      if (membership.linkedType === "STEPS") {
        // Check steps for this day
        const stepsEntry = await prisma.stepsEntry.findFirst({
          where: {
            userId: session.user.id,
            date: {
              gte: startOfDay(day),
              lte: endOfDay(day),
            },
          },
        })

        if (stepsEntry && membership.minSteps) {
          shouldCreateEntry = stepsEntry.count >= membership.minSteps
        } else if (stepsEntry) {
          shouldCreateEntry = stepsEntry.count >= 10000 // Default 10k
        }
      } else if (membership.linkedType === "SPORT") {
        // Check sport activities for this day
        const activities = await prisma.sportActivity.findMany({
          where: {
            userId: session.user.id,
            date: {
              gte: startOfDay(day),
              lte: endOfDay(day),
            },
            ...(membership.sportActivityType
              ? { activityType: membership.sportActivityType }
              : {}),
          },
        })

        if (activities.length > 0) {
          if (membership.minDuration) {
            const totalDuration = activities.reduce((sum, a) => sum + (a.duration || 0), 0)
            shouldCreateEntry = totalDuration >= membership.minDuration
          } else {
            shouldCreateEntry = true
          }
        }
      } else if (membership.linkedType === "HABIT" && membership.linkedHabitId) {
        // Check habit completion for this day
        const habitCompletion = await prisma.habitCompletion.findFirst({
          where: {
            habitId: membership.linkedHabitId,
            date: {
              gte: startOfDay(day),
              lte: endOfDay(day),
            },
          },
        })

        shouldCreateEntry = !!habitCompletion
      }

      if (shouldCreateEntry) {
        await prisma.groupChallengeEntry.create({
          data: {
            memberId: membership.id,
            date: day,
            value: 1,
          },
        })
        newEntries.push({ date: day, value: 1 })
        newEntriesCount++
      }
    }

    // Calculate new progress
    const allEntries = [
      ...membership.entries.map((e) => ({ date: new Date(e.date), value: e.value })),
      ...newEntries,
    ]

    let newCurrentValue: number
    if (challenge.challengeType === "WEEKLY_HABIT" && challenge.weeklyTarget) {
      newCurrentValue = calculateCompletedWeeks(
        allEntries,
        challenge.startDate,
        challenge.weeklyTarget
      )
    } else {
      newCurrentValue = allEntries.length
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
      success: true,
      newEntriesCount,
      currentValue: newCurrentValue,
      isCompleted: shouldAutoComplete,
    })
  } catch (error) {
    console.error("Error syncing data:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
