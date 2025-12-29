import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") || "WORK"
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!from || !to) {
      return NextResponse.json({ error: "Missing from/to params" }, { status: 400 })
    }

    // Get task counts grouped by date
    const counts = await prisma.task.groupBy({
      by: ['scheduledDate'],
      where: {
        userId: session.user.id,
        workspaceType: workspace,
        scheduledDate: {
          gte: new Date(from),
          lte: new Date(to),
        },
        status: {
          not: 'CANCELLED',
        },
      },
      _count: {
        id: true,
      },
    })

    // Transform to simpler format
    const result = counts
      .filter((c: { scheduledDate: Date | null }) => c.scheduledDate !== null)
      .map((c: { scheduledDate: Date | null; _count: { id: number } }) => ({
        date: c.scheduledDate!.toISOString().split('T')[0],
        count: c._count.id,
      }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching task counts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
