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

    const steps = await prisma.stepsEntry.findMany({
      where,
      orderBy: { date: "desc" },
    })

    return NextResponse.json(steps)
  } catch (error) {
    console.error("Error fetching steps:", error)
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
    const { date, count, notes, isPublic } = body

    if (!date || count === undefined) {
      return NextResponse.json({ error: "Data i liczba kroków są wymagane" }, { status: 400 })
    }

    const entryDate = new Date(date)
    entryDate.setHours(0, 0, 0, 0)

    // Upsert - update if exists, create if not
    const steps = await prisma.stepsEntry.upsert({
      where: {
        userId_date: {
          userId: session.user.id,
          date: entryDate,
        },
      },
      update: {
        count,
        notes,
        isPublic: isPublic !== undefined ? isPublic : true,
      },
      create: {
        date: entryDate,
        count,
        notes,
        isPublic: isPublic !== undefined ? isPublic : true,
        userId: session.user.id,
      },
    })

    return NextResponse.json(steps, { status: 201 })
  } catch (error) {
    console.error("Error saving steps:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
