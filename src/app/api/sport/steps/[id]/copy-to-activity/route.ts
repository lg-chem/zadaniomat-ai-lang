import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Copy steps entry as sport activity (for streak)
export async function POST(
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
    const { typeId } = body // Which activity type to copy as

    const stepsEntry = await prisma.stepsEntry.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!stepsEntry) {
      return NextResponse.json({ error: "Steps entry not found" }, { status: 404 })
    }

    // Create activity from steps
    const activity = await prisma.sportActivity.create({
      data: {
        typeId,
        date: stepsEntry.date,
        duration: null, // Steps don't have duration
        notes: `${stepsEntry.count} kroków`,
        fromSteps: true,
        userId: session.user.id,
      },
      include: {
        type: true,
      },
    })

    // Mark steps as copied
    await prisma.stepsEntry.update({
      where: { id },
      data: { copiedToActivity: true },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    console.error("Error copying steps to activity:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
