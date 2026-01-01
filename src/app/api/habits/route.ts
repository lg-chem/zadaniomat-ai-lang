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
    const includeCompletions = searchParams.get("includeCompletions") === "true"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const habits = await prisma.habit.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        category: true,
        completions: includeCompletions
          ? {
              where: startDate && endDate
                ? {
                    date: {
                      gte: new Date(startDate),
                      lte: new Date(endDate),
                    },
                  }
                : undefined,
              orderBy: { date: "desc" },
            }
          : false,
      },
      orderBy: { createdAt: "asc" },
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
    const { name, description, frequency, targetCount, defaultMinutes, color, icon, categoryId, isPublic } = body

    if (!name) {
      return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 })
    }

    const habit = await prisma.habit.create({
      data: {
        name,
        description,
        frequency: frequency || "DAILY",
        targetCount: targetCount || 1,
        defaultMinutes: defaultMinutes ? parseInt(defaultMinutes) : null,
        color: color || "#10b981",
        icon,
        categoryId,
        isPublic: isPublic || false,
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
