import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - fetch weekly template blocks or blocks for a specific date
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = (searchParams.get("workspace") || "WORK") as "WORK" | "PRIVATE"
    const date = searchParams.get("date") // Optional: specific date for override check
    const dayOfWeek = searchParams.get("dayOfWeek") // Optional: filter by day (0-6)

    // If specific date is provided, check for override first
    if (date) {
      const override = await prisma.dailyScheduleOverride.findUnique({
        where: {
          userId_date_workspaceType: {
            userId: session.user.id,
            date: new Date(date),
            workspaceType: workspace,
          },
        },
      })

      if (override) {
        return NextResponse.json({
          isOverride: true,
          date: date,
          blocks: override.blocks,
        })
      }

      // No override - return template blocks for that day of week
      const dateObj = new Date(date)
      const dayIndex = (dateObj.getDay() + 6) % 7 // Convert to 0=Monday format

      const templateBlocks = await prisma.weeklyScheduleBlock.findMany({
        where: {
          userId: session.user.id,
          workspaceType: workspace,
          dayOfWeek: dayIndex,
          isActive: true,
        },
        orderBy: [{ startTime: "asc" }, { order: "asc" }],
      })

      return NextResponse.json({
        isOverride: false,
        date: date,
        dayOfWeek: dayIndex,
        blocks: templateBlocks,
      })
    }

    // No date - return all template blocks (for settings page)
    const whereClause: {
      userId: string
      workspaceType: "WORK" | "PRIVATE"
      dayOfWeek?: number
    } = {
      userId: session.user.id,
      workspaceType: workspace,
    }

    if (dayOfWeek !== null && dayOfWeek !== undefined) {
      whereClause.dayOfWeek = parseInt(dayOfWeek)
    }

    const blocks = await prisma.weeklyScheduleBlock.findMany({
      where: whereClause,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { order: "asc" }],
    })

    return NextResponse.json(blocks)
  } catch (error) {
    console.error("Error fetching schedule blocks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - create a new weekly template block
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      description,
      dayOfWeek,
      startTime,
      endTime,
      color = "#6366f1",
      workspaceType: wsType = "WORK",
      order = 0,
    } = body

    const workspaceType = wsType as "WORK" | "PRIVATE"

    // Validate required fields
    if (!name || dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Nazwa, dzień tygodnia, czas rozpoczęcia i zakończenia są wymagane" },
        { status: 400 }
      )
    }

    // Validate dayOfWeek (0-6)
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json(
        { error: "Dzień tygodnia musi być między 0 (poniedziałek) a 6 (niedziela)" },
        { status: 400 }
      )
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: "Nieprawidłowy format czasu (użyj HH:mm)" },
        { status: 400 }
      )
    }

    const block = await prisma.weeklyScheduleBlock.create({
      data: {
        name,
        description,
        dayOfWeek,
        startTime,
        endTime,
        color,
        workspaceType,
        order,
        userId: session.user.id,
      },
    })

    return NextResponse.json(block, { status: 201 })
  } catch (error) {
    console.error("Error creating schedule block:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
