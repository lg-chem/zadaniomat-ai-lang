import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    const period = await prisma.period.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        sprints: {
          include: {
            goals: true,
            _count: { select: { tasks: true } },
          },
          orderBy: { startDate: "asc" },
        },
        goals: true,
      },
    })

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 })
    }

    return NextResponse.json(period)
  } catch (error) {
    console.error("Error fetching period:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()

    const existingPeriod = await prisma.period.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingPeriod) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 })
    }

    const { name, startDate, endDate, isActive } = body
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = new Date(endDate)
    if (isActive !== undefined) updateData.isActive = isActive

    const period = await prisma.period.update({
      where: { id },
      data: updateData,
      include: {
        sprints: true,
        _count: { select: { sprints: true, goals: true } },
      },
    })

    return NextResponse.json(period)
  } catch (error) {
    console.error("Error updating period:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    const existingPeriod = await prisma.period.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingPeriod) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 })
    }

    await prisma.period.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting period:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
