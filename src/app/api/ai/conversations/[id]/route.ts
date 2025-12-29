import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { addDays } from "date-fns"

// GET - get conversation with messages
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

    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error("Error fetching conversation:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH - add message to conversation
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
    const { messages, summary } = body

    // Verify ownership
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Add messages if provided
    if (messages && Array.isArray(messages)) {
      await prisma.aIMessage.createMany({
        data: messages.map((m: { role: string; content: string }) => ({
          conversationId: id,
          role: m.role,
          content: m.content,
        })),
      })
    }

    // Update conversation
    const updated = await prisma.aIConversation.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        expiresAt: addDays(new Date(), 3), // Reset expiration on activity
        ...(summary ? { summary } : {}),
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return NextResponse.json({ conversation: updated })
  } catch (error) {
    console.error("Error updating conversation:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - delete conversation
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

    await prisma.aIConversation.deleteMany({
      where: {
        id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting conversation:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
