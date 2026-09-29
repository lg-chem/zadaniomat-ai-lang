import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isEmptyRichText } from "@/lib/rich-text"

// Per-user data - never prerendered at build time
export const dynamic = "force-dynamic"

const LIMIT = 60

// GET - tasks with a description, most recently written first (notes feed, ?q= searches)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const workspaceType = searchParams.get("workspace") === "PRIVATE" ? "PRIVATE" : "WORK"
    const q = searchParams.get("q")?.trim()

    const tasks = await prisma.task.findMany({
      where: {
        workspaceType,
        description: { not: null },
        NOT: { description: "" },
        AND: [
          // Own tasks and tasks assigned to me (not the ones I handed to others)
          { OR: [{ userId, assignedToId: null }, { assignedToId: userId }] },
          ...(q
            ? [
                {
                  OR: [
                    { title: { contains: q, mode: "insensitive" as const } },
                    { description: { contains: q, mode: "insensitive" as const } },
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        subtasks: { orderBy: { order: "asc" } },
      },
      orderBy: [{ descriptionUpdatedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      take: LIMIT * 3,
    })

    // A recurring task copies its description to every day - show each text once, newest first
    const seen = new Set<string>()
    const feed = tasks.filter((task) => {
      if (isEmptyRichText(task.description)) return false
      const key = `${task.title}\u0000${task.description}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json(feed.slice(0, LIMIT))
  } catch (error) {
    console.error("Error fetching task notes:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
