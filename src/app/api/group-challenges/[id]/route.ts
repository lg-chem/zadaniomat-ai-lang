import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Get single group challenge details
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

    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
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
            },
          },
          orderBy: [
            { currentValue: "desc" },
            { joinedAt: "asc" },
          ],
        },
        invitations: {
          where: { status: "PENDING" },
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

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    const userMember = challenge.members.find((m) => m.userId === session.user.id)

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error("Error fetching group challenge:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH - Update group challenge (only creator can update)
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

    // Check if user is creator
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    if (challenge.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Tylko twórca może edytować wyzwanie" },
        { status: 403 }
      )
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
      weeklyTarget,
      isActive,
    } = body

    const updated = await prisma.groupChallenge.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(targetValue !== undefined && { targetValue: parseFloat(targetValue) }),
        ...(unit !== undefined && { unit }),
        ...(color !== undefined && { color }),
        ...(weeklyTarget !== undefined && {
          weeklyTarget: weeklyTarget ? parseInt(weeklyTarget) : null,
        }),
        ...(isActive !== undefined && { isActive }),
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
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating group challenge:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - Delete group challenge (only creator can delete)
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

    // Check if user is creator
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    if (challenge.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Tylko twórca może usunąć wyzwanie" },
        { status: 403 }
      )
    }

    await prisma.groupChallenge.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting group challenge:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
