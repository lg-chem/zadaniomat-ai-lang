import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId } = params
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Check if user exists and is approved
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        isApproved: true,
      },
      select: {
        id: true,
        name: true,
        image: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Użytkownik nie znaleziony" }, { status: 404 })
    }

    // Date range for completions/entries
    const dateFilter = startDate && endDate
      ? {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }
      : undefined

    // Fetch public habits with completions
    const habits = await prisma.habit.findMany({
      where: {
        userId,
        isPublic: true,
        isActive: true,
      },
      include: {
        category: true,
        completions: dateFilter
          ? {
              where: dateFilter,
              orderBy: { date: "desc" },
            }
          : {
              orderBy: { date: "desc" },
              take: 30, // Last 30 completions if no date range
            },
      },
      orderBy: { createdAt: "asc" },
    })

    // Fetch public challenges with entries
    const challenges = await prisma.challenge.findMany({
      where: {
        userId,
        isPublic: true,
      },
      include: {
        milestones: {
          orderBy: { targetValue: "asc" },
        },
        entries: {
          orderBy: { date: "desc" },
        },
      },
      orderBy: { endDate: "asc" },
    })

    // Fetch public sport activities
    const sportActivities = await prisma.sportActivity.findMany({
      where: {
        userId,
        isPublic: true,
        ...(dateFilter || {}),
      },
      include: {
        type: true,
        bodyParts: true,
      },
      orderBy: { date: "desc" },
      take: 50, // Limit to last 50 activities
    })

    // Fetch public steps
    const steps = await prisma.stepsEntry.findMany({
      where: {
        userId,
        isPublic: true,
        ...(dateFilter || {}),
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json({
      user,
      habits,
      challenges,
      sportActivities,
      steps,
    })
  } catch (error) {
    console.error("Error fetching friend data:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
