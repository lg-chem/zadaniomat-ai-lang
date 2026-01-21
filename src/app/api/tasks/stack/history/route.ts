import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// GET - Get scheduled assigned tasks (in progress and completed)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") as "WORK" | "PRIVATE" | null
    const limit = parseInt(searchParams.get("limit") || "50")

    const baseWhere: Prisma.TaskWhereInput = {
      assignedToId: session.user.id,
      scheduledDate: { not: null },
      ...(workspace ? { workspaceType: workspace } : {})
    }

    const include = {
      category: { select: { id: true, name: true, color: true } },
      user: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true } },
      goal: { select: { id: true, title: true } },
      subtasks: { orderBy: { order: "asc" } as const }
    }

    // Note: scheduledDate is automatically included as it's a scalar field

    // Get in-progress tasks (scheduled but not completed)
    const inProgress = await prisma.task.findMany({
      where: {
        ...baseWhere,
        status: { not: "COMPLETED" }
      },
      include,
      orderBy: { scheduledDate: "asc" },
      take: limit
    })

    // Get completed tasks
    const completed = await prisma.task.findMany({
      where: {
        ...baseWhere,
        status: "COMPLETED"
      },
      include,
      orderBy: { updatedAt: "desc" },
      take: limit
    })

    return NextResponse.json({
      inProgress,
      completed
    })
  } catch (error) {
    console.error("Error fetching task history:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
