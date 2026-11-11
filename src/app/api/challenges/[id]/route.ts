import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { readLinkFields } from "@/lib/challenge-data"
import { challengeProgress, type ChallengeType } from "@/lib/tracking"

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

    const { name, description, targetValue, currentValue, isCompleted, color, startDate, endDate, weeklyTarget, unit, isPublic } = body
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
    if (isPublic !== undefined) updateData.isPublic = isPublic

    // What the challenge is counted from (own entries / a habit / sport / steps)
    if (body.linkedType !== undefined) {
      const link = await readLinkFields(session.user.id, body)
      if ("error" in link) {
        return NextResponse.json({ error: link.error }, { status: 400 })
      }
      Object.assign(updateData, link.data)
    }

    const challenge = await prisma.challenge.update({
      where: { id },
      data: updateData,
      include: {
        milestones: true,
        entries: true,
      },
    })

    // Counted from own entries: the start day, the weekly target or going back from a link
    // change what the entries add up to
    if (
      challenge.linkedType === "NONE" &&
      (body.linkedType !== undefined || startDate !== undefined || weeklyTarget !== undefined)
    ) {
      const recounted = challengeProgress(
        challenge.challengeType as ChallengeType,
        challenge.entries,
        challenge.startDate,
        challenge.weeklyTarget
      )
      if (recounted !== challenge.currentValue) {
        await prisma.challenge.update({ where: { id }, data: { currentValue: recounted } })
        challenge.currentValue = recounted
      }
    }

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
