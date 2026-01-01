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
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const where: Record<string, unknown> = {
      userId: session.user.id,
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const activities = await prisma.sportActivity.findMany({
      where,
      include: {
        type: true,
        bodyParts: true,
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(activities)
  } catch (error) {
    console.error("Error fetching activities:", error)
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
    const { typeId, date, duration, notes, bodyParts, fromSteps, isPublic } = body

    if (!typeId || !date) {
      return NextResponse.json({ error: "Typ i data są wymagane" }, { status: 400 })
    }

    const activity = await prisma.sportActivity.create({
      data: {
        typeId,
        date: new Date(date),
        duration,
        notes,
        fromSteps: fromSteps || false,
        isPublic: isPublic || false,
        userId: session.user.id,
        bodyParts: bodyParts?.length > 0
          ? {
              create: bodyParts.map((name: string) => ({ name })),
            }
          : undefined,
      },
      include: {
        type: true,
        bodyParts: true,
      },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    console.error("Error creating activity:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
