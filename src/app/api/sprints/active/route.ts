import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the active sprint in the user's active WORK period
    const activeSprint = await prisma.sprint.findFirst({
      where: {
        isActive: true,
        period: {
          userId: session.user.id,
          workspaceType: "WORK",
          isActive: true,
        },
      },
      include: {
        goals: {
          orderBy: { createdAt: "asc" },
          include: {
            category: true,
          },
        },
        period: {
          select: { id: true, name: true },
        },
      },
    })

    if (!activeSprint) {
      return NextResponse.json(null)
    }

    return NextResponse.json(activeSprint)
  } catch (error) {
    console.error("Error fetching active sprint:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
