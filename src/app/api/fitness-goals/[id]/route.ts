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

    const body = await req.json()
    const { currentValue, isCompleted } = body

    const updateData: Record<string, unknown> = {}

    if (currentValue !== undefined) {
      updateData.currentValue = parseFloat(currentValue)
    }

    if (isCompleted !== undefined) {
      updateData.isCompleted = isCompleted
    }

    const fitnessGoal = await prisma.fitnessGoal.update({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: updateData,
      include: {
        period: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    })

    return NextResponse.json(fitnessGoal)
  } catch (error) {
    console.error("Error updating fitness goal:", error)
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

    await prisma.fitnessGoal.delete({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting fitness goal:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
