import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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

    const existing = await prisma.challenge.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    const { name, description, targetValue, currentValue, isCompleted, color, startDate, endDate, weeklyTarget, unit } = body
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (targetValue !== undefined) updateData.targetValue = parseFloat(targetValue)
    if (currentValue !== undefined) updateData.currentValue = parseFloat(currentValue)
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted
    if (color !== undefined) updateData.color = color
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = new Date(endDate)
    if (weeklyTarget !== undefined) updateData.weeklyTarget = weeklyTarget ? parseInt(weeklyTarget) : null
    if (unit !== undefined) updateData.unit = unit

    const challenge = await prisma.challenge.update({
      where: { id },
      data: updateData,
      include: {
        milestones: true,
        entries: true,
      },
    })

    return NextResponse.json(challenge)
  } catch (error) {
    console.error("Error updating challenge:", error)
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

    const existing = await prisma.challenge.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    await prisma.challenge.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting challenge:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
