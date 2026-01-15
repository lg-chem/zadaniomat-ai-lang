import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { addDays } from "date-fns"

// GET - list conversations
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")
    const workspace = searchParams.get("workspace") || "WORK"

    // Delete expired conversations first
    await prisma.aIConversation.deleteMany({
      where: {
        userId: session.user.id,
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    const conversations = await prisma.aIConversation.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
        ...(type ? { type: type as any } : {}),
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    })

    return NextResponse.json({
      conversations: conversations.map((c: { id: string; type: string; summary?: string | null; messages: Array<{ content?: string | null }>; _count: { messages: number }; createdAt: Date; updatedAt: Date; expiresAt?: Date | null }) => ({
        id: c.id,
        type: c.type,
        summary: c.summary || c.messages[0]?.content?.slice(0, 50) + "..." || "Nowa rozmowa",
        messagesCount: c._count.messages,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        expiresAt: c.expiresAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - create new conversation
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { type, workspace = "WORK" } = body

    const conversation = await prisma.aIConversation.create({
      data: {
        userId: session.user.id,
        type: type || "GENERAL",
        workspaceType: workspace,
        expiresAt: addDays(new Date(), 3), // Expire after 3 days
      },
    })

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error("Error creating conversation:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
