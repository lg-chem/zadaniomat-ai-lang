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

    const existing = await prisma.sportActivity.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 })
    }

    const { duration, notes, isPublic, bodyParts, typeId, date } = body
    const updateData: Record<string, unknown> = {}

    if (duration !== undefined) updateData.duration = duration
    if (notes !== undefined) updateData.notes = notes
    if (isPublic !== undefined) updateData.isPublic = isPublic
    if (typeId !== undefined) updateData.typeId = typeId
    if (date !== undefined) updateData.date = new Date(date)

    // Handle body parts update
    if (bodyParts !== undefined) {
      // First disconnect all existing body parts
      await prisma.sportActivity.update({
        where: { id },
        data: {
          bodyParts: { set: [] },
        },
      })

      // Then connect new ones
      if (bodyParts.length > 0) {
        const bodyPartRecords = await prisma.bodyPart.findMany({
          where: { name: { in: bodyParts } },
        })
        updateData.bodyParts = {
          connect: bodyPartRecords.map((bp: { id: string }) => ({ id: bp.id })),
        }
      }
    }

    const activity = await prisma.sportActivity.update({
      where: { id },
      data: updateData,
      include: {
        type: true,
        bodyParts: true,
      },
    })

    return NextResponse.json(activity)
  } catch (error) {
    console.error("Error updating activity:", error)
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

    const existing = await prisma.sportActivity.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 })
    }

    await prisma.sportActivity.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting activity:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
