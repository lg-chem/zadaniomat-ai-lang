import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { duration, notes } = body

    // Verify ownership
    const task = await prisma.task.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Create time entry and update actual minutes
    const [timeEntry] = await prisma.$transaction([
      prisma.timeEntry.create({
        data: {
          taskId: id,
          startTime: new Date(Date.now() - duration * 60000),
          endTime: new Date(),
          duration,
          notes,
        },
      }),
      prisma.task.update({
        where: { id },
        data: {
          actualMinutes: {
            increment: duration,
          },
        },
      }),
    ])

    return NextResponse.json(timeEntry, { status: 201 })
  } catch (error) {
    console.error("Error adding time entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
