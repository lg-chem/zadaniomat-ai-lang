import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Get messages for organization
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
    const before = searchParams.get("before") // For pagination

    // Check if user is member of organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: id,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Brak dostępu" }, { status: 403 })
    }

    const messages = await prisma.teamMessage.findMany({
      where: {
        organizationId: id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    // Return in chronological order
    return NextResponse.json(messages.reverse())
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - Send a message
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

    if (!content?.trim()) {
      return NextResponse.json({ error: "Treść wiadomości jest wymagana" }, { status: 400 })
    }

    // Check if user is member of organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: id,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Brak dostępu" }, { status: 403 })
    }

    const message = await prisma.teamMessage.create({
      data: {
        content: content.trim(),
        organizationId: id,
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
