import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Legacy periods (custom dates, before calendar quarters) with their goals - read only
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const periods = await prisma.period.findMany({
      where: { userId, workspaceType: "WORK", year: null },
      orderBy: { startDate: "desc" },
      include: {
        goals: {
          where: { userId, isStep: false, parentGoalId: null },
          orderBy: { createdAt: "asc" },
          include: { category: { select: { id: true, name: true, color: true } } },
        },
        sprints: {
          orderBy: { startDate: "asc" },
          include: {
            goals: {
              where: { userId, isStep: false },
              orderBy: { createdAt: "asc" },
              select: { id: true, title: true, isCompleted: true },
            },
          },
        },
      },
    })

    return NextResponse.json(
      periods.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        goals: p.goals
          .filter((g) => !g.sprintId)
          .map((g) => ({
            id: g.id,
            title: g.title,
            isCompleted: g.isCompleted,
            carriedOver: g.carriedOver,
            currentValue: g.currentValue,
            targetValue: g.targetValue,
            unit: g.unit,
            category: g.category,
          })),
        sprints: p.sprints.map((s) => ({
          id: s.id,
          name: s.name,
          startDate: s.startDate,
          endDate: s.endDate,
          goals: s.goals,
        })),
      }))
    )
  } catch (error) {
    console.error("Error fetching goal archive:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
