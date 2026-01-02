import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// POST - Invite users to group challenge
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
    const { userIds } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "Wymagana jest lista użytkowników do zaproszenia" },
        { status: 400 }
      )
    }

    // Check if user is a member (any member can invite)
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

    // Get existing members and invitations
    const existingMembers = await prisma.groupChallengeMember.findMany({
      where: { challengeId: id },
      select: { userId: true },
    })

    const existingInvitations = await prisma.groupChallengeInvitation.findMany({
      where: { challengeId: id },
      select: { userId: true },
    })

    const existingUserIds = new Set([
      ...existingMembers.map((m) => m.userId),
      ...existingInvitations.map((i) => i.userId),
    ])

    // Filter out users who are already members or invited
    const newUserIds = userIds.filter((userId: string) => !existingUserIds.has(userId))

    if (newUserIds.length === 0) {
      return NextResponse.json(
        { error: "Wszyscy użytkownicy są już zaproszeni lub są członkami" },
        { status: 400 }
      )
    }

    // Create invitations
    const invitations = await prisma.groupChallengeInvitation.createMany({
      data: newUserIds.map((userId: string) => ({
        challengeId: id,
        userId,
        status: "PENDING",
      })),
    })

    // Fetch created invitations with user details
    const createdInvitations = await prisma.groupChallengeInvitation.findMany({
      where: {
        challengeId: id,
        userId: { in: newUserIds },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      invitedCount: invitations.count,
      invitations: createdInvitations,
    })
  } catch (error) {
    console.error("Error inviting users:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - Cancel invitation (only creator can cancel)
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
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "Wymagane jest ID użytkownika" },
        { status: 400 }
      )
    }

    // Check if user is creator
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    if (challenge.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Tylko twórca może anulować zaproszenia" },
        { status: 403 }
      )
    }

    await prisma.groupChallengeInvitation.delete({
      where: {
        challengeId_userId: {
          challengeId: id,
          userId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error canceling invitation:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
