import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { differenceInDays, isSameDay, addDays } from "date-fns"

interface MemberStats {
  memberId: string
  userName: string
  userImage: string | null
  totalEntries: number
  totalSteps: number
  totalDuration: number
  averageSteps: number
  averageDuration: number
  longestStreak: number
  currentStreak: number
  activities: { [key: string]: number }
}

function calculateStreak(
  entries: { date: Date }[],
  startDate: Date,
  endDate: Date
): { longest: number; current: number } {
  if (entries.length === 0) return { longest: 0, current: 0 }

  // Sort entries by date
  const sortedDates = entries
    .map((e) => new Date(e.date))
    .sort((a, b) => a.getTime() - b.getTime())

  let longestStreak = 1
  let currentStreak = 1
  let tempStreak = 1

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = differenceInDays(sortedDates[i], sortedDates[i - 1])

    if (diff === 1) {
      tempStreak++
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak
      }
    } else if (diff > 1) {
      tempStreak = 1
    }
    // diff === 0 means same day, skip
  }

  // Calculate current streak (from today backwards)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = addDays(today, -1)

  // Check if there's an entry today or yesterday to start counting
  const hasToday = sortedDates.some((d) => isSameDay(d, today))
  const hasYesterday = sortedDates.some((d) => isSameDay(d, yesterday))

  if (hasToday || hasYesterday) {
    currentStreak = hasToday ? 1 : 0
    let checkDate = hasToday ? yesterday : addDays(yesterday, -1)

    while (true) {
      const hasEntry = sortedDates.some((d) => isSameDay(d, checkDate))
      if (hasEntry) {
        currentStreak++
        checkDate = addDays(checkDate, -1)
      } else {
        break
      }
    }
  } else {
    currentStreak = 0
  }

  return { longest: longestStreak, current: currentStreak }
}

// GET - Get detailed statistics for a group challenge
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check if user is a member
    const membership = await prisma.groupChallengeMember.findUnique({
      where: {
        challengeId_userId: {
          challengeId: id,
          userId: session.user.id,
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Nie jesteś członkiem tego wyzwania" },
        { status: 403 }
      )
    }

    // Get challenge with all members and their entries
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            entries: {
              orderBy: { date: "asc" },
            },
          },
        },
      },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    // Calculate stats for each member
    const memberStats: MemberStats[] = challenge.members.map((member) => {
      const entries = member.entries

      // Total counts
      const totalEntries = entries.length
      const totalSteps = entries.reduce((sum, e) => sum + (e.stepsCount || 0), 0)
      const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0)

      // Averages (only for entries that have the data)
      const entriesWithSteps = entries.filter((e) => e.stepsCount)
      const entriesWithDuration = entries.filter((e) => e.duration)

      const averageSteps = entriesWithSteps.length > 0
        ? Math.round(totalSteps / entriesWithSteps.length)
        : 0

      const averageDuration = entriesWithDuration.length > 0
        ? Math.round(totalDuration / entriesWithDuration.length)
        : 0

      // Streaks
      const { longest, current } = calculateStreak(
        entries,
        challenge.startDate,
        challenge.endDate
      )

      // Activity breakdown
      const activities: { [key: string]: number } = {}
      entries.forEach((e) => {
        if (e.activityType) {
          activities[e.activityType] = (activities[e.activityType] || 0) + 1
        }
      })

      return {
        memberId: member.id,
        userName: member.user.name || "Użytkownik",
        userImage: member.user.image,
        totalEntries,
        totalSteps,
        totalDuration,
        averageSteps,
        averageDuration,
        longestStreak: longest,
        currentStreak: current,
        activities,
      }
    })

    // Sort by different criteria for leaderboards
    const byTotalEntries = [...memberStats].sort((a, b) => b.totalEntries - a.totalEntries)
    const byTotalSteps = [...memberStats].sort((a, b) => b.totalSteps - a.totalSteps)
    const byTotalDuration = [...memberStats].sort((a, b) => b.totalDuration - a.totalDuration)
    const byLongestStreak = [...memberStats].sort((a, b) => b.longestStreak - a.longestStreak)
    const byCurrentStreak = [...memberStats].sort((a, b) => b.currentStreak - a.currentStreak)
    const byAverageSteps = [...memberStats].sort((a, b) => b.averageSteps - a.averageSteps)
    const byAverageDuration = [...memberStats].sort((a, b) => b.averageDuration - a.averageDuration)

    return NextResponse.json({
      memberStats,
      leaderboards: {
        totalEntries: byTotalEntries,
        totalSteps: byTotalSteps,
        totalDuration: byTotalDuration,
        longestStreak: byLongestStreak,
        currentStreak: byCurrentStreak,
        averageSteps: byAverageSteps,
        averageDuration: byAverageDuration,
      },
      // Summary stats
      summary: {
        totalGroupEntries: memberStats.reduce((sum, m) => sum + m.totalEntries, 0),
        totalGroupSteps: memberStats.reduce((sum, m) => sum + m.totalSteps, 0),
        totalGroupDuration: memberStats.reduce((sum, m) => sum + m.totalDuration, 0),
        bestStreak: Math.max(...memberStats.map((m) => m.longestStreak)),
        membersCount: memberStats.length,
      },
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
