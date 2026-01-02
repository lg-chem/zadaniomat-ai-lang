import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Get messages for a group challenge
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
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const cursor = searchParams.get("cursor")

    // Check if user is a member of this challenge
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

    const messages = await prisma.groupChallengeMessage.findMany({
      where: { challengeId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    return NextResponse.json({
      messages: messages.reverse(), // Reverse to show oldest first
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - Send a new message
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
    const { content } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Wiadomość nie może być pusta" },
        { status: 400 }
      )
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: "Wiadomość jest za długa (max 1000 znaków)" },
        { status: 400 }
      )
    }

    // Check if user is a member of this challenge
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

    const message = await prisma.groupChallengeMessage.create({
      data: {
        content: content.trim(),
        challengeId: id,
        userId: session.user.id,
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

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
