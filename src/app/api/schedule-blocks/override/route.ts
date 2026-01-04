import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

interface BlockData {
  name: string
  description?: string
  startTime: string
  endTime: string
  color?: string
  order?: number
}

// GET - fetch override for a specific date
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = (searchParams.get("workspace") || "WORK") as "WORK" | "PRIVATE"
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json({ error: "Data jest wymagana" }, { status: 400 })
    }

    const override = await prisma.dailyScheduleOverride.findUnique({
      where: {
        userId_date_workspaceType: {
          userId: session.user.id,
          date: new Date(date),
          workspaceType: workspace,
        },
      },
    })

    if (!override) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      override,
    })
  } catch (error) {
    console.error("Error fetching schedule override:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - create or update override for a specific date
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { date, blocks, workspaceType: wsType = "WORK" } = body
    const workspaceType = wsType as "WORK" | "PRIVATE"

    if (!date || !blocks) {
      return NextResponse.json(
        { error: "Data i bloki są wymagane" },
        { status: 400 }
      )
    }

    // Validate blocks array
    if (!Array.isArray(blocks)) {
      return NextResponse.json(
        { error: "Bloki muszą być tablicą" },
        { status: 400 }
      )
    }

    // Validate each block
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    for (const block of blocks as BlockData[]) {
      if (!block.name || !block.startTime || !block.endTime) {
        return NextResponse.json(
          { error: "Każdy blok musi mieć nazwę, czas rozpoczęcia i zakończenia" },
          { status: 400 }
        )
      }
      if (!timeRegex.test(block.startTime) || !timeRegex.test(block.endTime)) {
        return NextResponse.json(
          { error: "Nieprawidłowy format czasu (użyj HH:mm)" },
          { status: 400 }
        )
      }
    }

    // Upsert the override
    const override = await prisma.dailyScheduleOverride.upsert({
      where: {
        userId_date_workspaceType: {
          userId: session.user.id,
          date: new Date(date),
          workspaceType,
        },
      },
      update: {
        blocks,
      },
      create: {
        date: new Date(date),
        workspaceType,
        blocks,
        userId: session.user.id,
      },
    })

    return NextResponse.json(override, { status: 201 })
  } catch (error) {
    console.error("Error creating/updating schedule override:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - remove override for a specific date (revert to template)
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = (searchParams.get("workspace") || "WORK") as "WORK" | "PRIVATE"
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json({ error: "Data jest wymagana" }, { status: 400 })
    }

    await prisma.dailyScheduleOverride.delete({
      where: {
        userId_date_workspaceType: {
          userId: session.user.id,
          date: new Date(date),
          workspaceType: workspace,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting schedule override:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
