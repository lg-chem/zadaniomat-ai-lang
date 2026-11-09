import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { goalTaskSelect, withLinkedNotes } from "@/lib/goal-tasks"

// Per-user data - never prerendered at build time
export const dynamic = "force-dynamic"

// GET - tasks of all the sprint's commitments in one request (the goals page groups them by goalId)
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const sprint = await prisma.sprint.findFirst({
      where: { id: params.id, period: { userId } },
      select: { id: true },
    })
    if (!sprint) {
      return NextResponse.json({ error: "Sprint nie znaleziony" }, { status: 404 })
    }

    const tasks = await prisma.task.findMany({
      where: { goal: { sprintId: sprint.id, userId }, status: { not: "CANCELLED" } },
      select: goalTaskSelect,
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(await withLinkedNotes(userId, tasks))
  } catch (error) {
    console.error("Error fetching sprint tasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
