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

    const sprint = await prisma.sprint.findFirst({
      where: {
        id,
        period: { userId: session.user.id },
      },
      include: {
        period: true,
        goals: true,
        tasks: {
          include: { category: true },
          orderBy: { createdAt: "desc" },
        },
        retrospective: true,
      },
    })

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    return NextResponse.json(sprint)
  } catch (error) {
    console.error("Error fetching sprint:", error)
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

    const existingSprint = await prisma.sprint.findFirst({
      where: { id, period: { userId: session.user.id } },
    })

    if (!existingSprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    const { name, startDate, endDate, isActive } = body
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = new Date(endDate)
    if (isActive !== undefined) updateData.isActive = isActive

    const sprint = await prisma.sprint.update({
      where: { id },
      data: updateData,
      include: {
        period: { select: { id: true, name: true } },
        _count: { select: { tasks: true, goals: true } },
      },
    })

    return NextResponse.json(sprint)
  } catch (error) {
    console.error("Error updating sprint:", error)
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

    const existingSprint = await prisma.sprint.findFirst({
      where: { id, period: { userId: session.user.id } },
    })

    if (!existingSprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    await prisma.sprint.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting sprint:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
