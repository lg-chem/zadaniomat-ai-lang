import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - List all group challenges user is part of (as creator or member)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const showCompleted = searchParams.get("showCompleted") === "true"

    // Find all challenges where user is a member
    const memberChallenges = await prisma.groupChallengeMember.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        challengeId: true,
      },
    })

    const challengeIds = memberChallenges.map((m) => m.challengeId)

    const challenges = await prisma.groupChallenge.findMany({
      where: {
        id: { in: challengeIds },
        isActive: true,
        ...(showCompleted
          ? {}
          : {
              endDate: { gte: new Date() },
            }),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
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
              orderBy: { date: "desc" },
              take: 30, // Last 30 entries
            },
          },
          orderBy: [
            { currentValue: "desc" },
            { joinedAt: "asc" },
          ],
        },
        _count: {
          select: {
            members: true,
            invitations: {
              where: { status: "PENDING" },
            },
          },
        },
      },
      orderBy: { endDate: "asc" },
    })

    // Add user's membership info to each challenge
    const result = challenges.map((challenge) => {
      const userMember = challenge.members.find((m) => m.userId === session.user.id)
      return {
        ...challenge,
        userMembership: userMember
          ? {
              id: userMember.id,
              role: userMember.role,
              currentValue: userMember.currentValue,
              isCompleted: userMember.isCompleted,
              entries: userMember.entries,
            }
          : null,
        isCreator: challenge.creatorId === session.user.id,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching group challenges:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - Create a new group challenge
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
      startDate,
      endDate,
      targetValue,
      unit,
      color,
      challengeType,
      weeklyTarget,
      dailyTarget,
      linkedType,
      linkedHabitId,
      inviteUserIds,
    } = body

    if (!name || !startDate || !endDate || !targetValue || !unit) {
      return NextResponse.json(
        { error: "Wymagane pola: nazwa, daty, cel, jednostka" },
        { status: 400 }
      )
    }

    // For weekly habits, weeklyTarget is required
    if (challengeType === "WEEKLY_HABIT" && !weeklyTarget) {
      return NextResponse.json(
        { error: "Dla nawyku tygodniowego wymagana jest liczba dni w tygodniu" },
        { status: 400 }
      )
    }

    // Create challenge with creator as first member
    const challenge = await prisma.groupChallenge.create({
      data: {
        name,
        description,
        challengeType: challengeType || "NUMERIC",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        targetValue: parseFloat(targetValue),
        unit,
        weeklyTarget: weeklyTarget ? parseInt(weeklyTarget) : null,
        dailyTarget: dailyTarget ? parseFloat(dailyTarget) : null,
        linkedType: linkedType || "NONE",
        linkedHabitId: linkedHabitId || null,
        color: color || "#8b5cf6",
        creatorId: session.user.id,
        // Add creator as first member with CREATOR role
        members: {
          create: {
            userId: session.user.id,
            role: "CREATOR",
          },
        },
        // Create invitations for invited users
        ...(inviteUserIds && inviteUserIds.length > 0
          ? {
              invitations: {
                create: inviteUserIds
                  .filter((id: string) => id !== session.user.id)
                  .map((userId: string) => ({
                    userId,
                    status: "PENDING",
                  })),
              },
            }
          : {}),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        invitations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(challenge, { status: 201 })
  } catch (error) {
    console.error("Error creating group challenge:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
