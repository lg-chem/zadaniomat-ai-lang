import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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
    const { duration, notes } = body

    if (!Number.isInteger(duration) || duration <= 0) {
      return NextResponse.json({ error: "Duration must be a positive number of minutes" }, { status: 400 })
    }

    // Verify the user owns or is assigned to the task
    const task = await prisma.task.findFirst({
      where: {
        id,
        OR: [{ userId: session.user.id }, { assignedToId: session.user.id }],
      },
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
