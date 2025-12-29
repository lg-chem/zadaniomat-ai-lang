import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { startOfDay } from "date-fns"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") || "WORK"

    // Get tasks from past days that are not completed or cancelled
    const today = startOfDay(new Date())

    const overdueTasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace,
        scheduledDate: {
          lt: today, // Before today
        },
        status: {
          in: ["NEW", "IN_PROGRESS"], // Only unfinished tasks
        },
      },
      include: {
        category: true,
        goal: {
          select: { id: true, title: true },
        },
      },
      orderBy: [
        { scheduledDate: "asc" }, // Oldest first
        { orderInDay: "asc" },
      ],
    })

    return NextResponse.json(overdueTasks)
  } catch (error) {
    console.error("Error fetching overdue tasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
