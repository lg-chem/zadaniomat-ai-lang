import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { loadHabits } from "@/lib/habit-data"
import { dayKeyOf, isDayKey } from "@/lib/tracking"

export const dynamic = "force-dynamic"

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

// GET - active habits with the completions of ?from=&to= (yyyy-MM-dd) and streaks counted to ?today=
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    // startDate / endDate - the names used before
    const from = searchParams.get("from") ?? searchParams.get("startDate")
    const to = searchParams.get("to") ?? searchParams.get("endDate")
    const todayParam = searchParams.get("today")
    const today = isDayKey(todayParam) ? todayParam : dayKeyOf(new Date())

    const habits = await loadHabits(session.user.id, {
      from: isDayKey(from) ? from : null,
      to: isDayKey(to) ? to : null,
      today,
    })

    return NextResponse.json(habits)
  } catch (error) {
    console.error("Error fetching habits:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      name, description, frequency, targetCount, defaultMinutes, color, icon, categoryId, isPublic,
      unit, scheduledTime,
    } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 })
    }

    const habit = await prisma.habit.create({
      data: {
        name: String(name).trim(),
        description,
        frequency: frequency || "DAILY",
        targetCount: Math.max(1, parseInt(targetCount) || 1),
        defaultMinutes: defaultMinutes ? parseInt(defaultMinutes) : null,
        unit: unit ? String(unit).trim().slice(0, 20) : null,
        scheduledTime: typeof scheduledTime === "string" && TIME.test(scheduledTime) ? scheduledTime : null,
        color: color || "#10b981",
        icon,
        categoryId: categoryId || null,
        // Private unless shared on purpose
        isPublic: isPublic === true,
        userId: session.user.id,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json(habit, { status: 201 })
  } catch (error) {
    console.error("Error creating habit:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
