import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// GET - Get completed assigned tasks (task history)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") as "WORK" | "PRIVATE" | null
    const limit = parseInt(searchParams.get("limit") || "50")

    // Get completed tasks that were assigned to current user
    const where: Prisma.TaskWhereInput = {
      assignedToId: session.user.id,
      status: "COMPLETED",
      ...(workspace ? { workspaceType: workspace } : {})
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, email: true } }, // Task creator
        organization: { select: { id: true, name: true } },
        subtasks: { orderBy: { order: "asc" } }
      },
      orderBy: { updatedAt: "desc" },
      take: limit
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching task history:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
