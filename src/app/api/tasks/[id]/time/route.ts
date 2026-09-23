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
    const { duration, durationSeconds, notes } = body

    // Timer sends exact seconds, older clients send whole minutes
    const seconds = durationSeconds !== undefined ? durationSeconds : duration * 60
    if (!Number.isInteger(seconds) || seconds <= 0) {
      return NextResponse.json({ error: "Duration must be a positive number of seconds or minutes" }, { status: 400 })
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

    // Add the seconds to the task's time, carrying full minutes into actualMinutes
    const totalSeconds = task.actualMinutes * 60 + task.actualExtraSeconds + seconds
    const endTime = new Date()

    const [timeEntry] = await prisma.$transaction([
      prisma.timeEntry.create({
        data: {
          taskId: id,
          startTime: new Date(endTime.getTime() - seconds * 1000),
          endTime,
          duration: Math.round(seconds / 60),
          notes,
        },
      }),
      prisma.task.update({
        where: { id },
        data: {
          actualMinutes: Math.floor(totalSeconds / 60),
          actualExtraSeconds: totalSeconds % 60,
        },
      }),
    ])

    return NextResponse.json(timeEntry, { status: 201 })
  } catch (error) {
    console.error("Error adding time entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
