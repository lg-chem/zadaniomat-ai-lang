import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { utcToday } from "@/lib/quarters"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the sprint that contains today in the user's WORK periods
    // (dates decide - the isActive flag is never switched off)
    const today = utcToday()
    const activeSprint = await prisma.sprint.findFirst({
      where: {
        startDate: { lte: today },
        endDate: { gte: today },
        period: {
          userId: session.user.id,
          workspaceType: "WORK",
        },
      },
      orderBy: { startDate: "desc" },
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
