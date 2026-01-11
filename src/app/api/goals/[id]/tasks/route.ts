import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Get tasks for a specific goal (unscheduled tasks)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: goalId } = await params

    // Verify goal belongs to user
    const goal = await prisma.goal.findFirst({
      where: {
        id: goalId,
        userId: session.user.id,
      },
    })

    if (!goal) {
      return NextResponse.json({ error: "Cel nie znaleziony" }, { status: 404 })
    }

    // Get tasks for this goal that are NOT scheduled (no scheduledDate)
    const tasks = await prisma.task.findMany({
      where: {
        goalId,
        userId: session.user.id,
        scheduledDate: null, // Only unscheduled tasks
      },
      include: {
        category: true,
        subtasks: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching goal tasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
