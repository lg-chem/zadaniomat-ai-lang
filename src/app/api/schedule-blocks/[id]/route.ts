import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - fetch single block
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const block = await prisma.weeklyScheduleBlock.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!block) {
      return NextResponse.json({ error: "Blok nie został znaleziony" }, { status: 404 })
    }

    return NextResponse.json(block)
  } catch (error) {
    console.error("Error fetching schedule block:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH - update block
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    // Verify ownership
    const existingBlock = await prisma.weeklyScheduleBlock.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingBlock) {
      return NextResponse.json({ error: "Blok nie został znaleziony" }, { status: 404 })
    }

    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (body.startTime && !timeRegex.test(body.startTime)) {
      return NextResponse.json(
        { error: "Nieprawidłowy format czasu rozpoczęcia (użyj HH:mm)" },
        { status: 400 }
      )
    }
    if (body.endTime && !timeRegex.test(body.endTime)) {
      return NextResponse.json(
        { error: "Nieprawidłowy format czasu zakończenia (użyj HH:mm)" },
        { status: 400 }
      )
    }

    // Validate dayOfWeek if provided
    if (body.dayOfWeek !== undefined && (body.dayOfWeek < 0 || body.dayOfWeek > 6)) {
      return NextResponse.json(
        { error: "Dzień tygodnia musi być między 0 (poniedziałek) a 6 (niedziela)" },
        { status: 400 }
      )
    }

    const updatedBlock = await prisma.weeklyScheduleBlock.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.dayOfWeek !== undefined && { dayOfWeek: body.dayOfWeek }),
        ...(body.startTime !== undefined && { startTime: body.startTime }),
        ...(body.endTime !== undefined && { endTime: body.endTime }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.order !== undefined && { order: body.order }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })

    return NextResponse.json(updatedBlock)
  } catch (error) {
    console.error("Error updating schedule block:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - delete block
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const existingBlock = await prisma.weeklyScheduleBlock.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingBlock) {
      return NextResponse.json({ error: "Blok nie został znaleziony" }, { status: 404 })
    }

    await prisma.weeklyScheduleBlock.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting schedule block:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
