import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Get task stack (unscheduled assigned tasks)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace")

    // Get tasks assigned to current user that are not yet scheduled
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: session.user.id,
        scheduledDate: null,
        status: { not: "COMPLETED" },
        ...(workspace ? { workspaceType: workspace } : {})
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, email: true } }, // Task creator
        organization: { select: { id: true, name: true } }
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" }
      ]
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching task stack:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
