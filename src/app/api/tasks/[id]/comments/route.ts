import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET all comments for a task
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify user has access to the task (owner, assignee, or team member)
    const task = await prisma.task.findFirst({
      where: {
        id,
        OR: [
          { userId: session.user.id },
          { assignedToId: session.user.id },
          {
            organization: {
              members: {
                some: { userId: session.user.id }
              }
            }
          }
        ]
      }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST create a new comment
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
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Treść komentarza jest wymagana" }, { status: 400 })
    }

    // Verify user has access to the task (owner, assignee, or team member)
    const task = await prisma.task.findFirst({
      where: {
        id,
        OR: [
          { userId: session.user.id },
          { assignedToId: session.user.id },
          {
            organization: {
              members: {
                some: { userId: session.user.id }
              }
            }
          }
        ]
      },
      include: {
        assignedTo: { select: { id: true } },
        user: { select: { id: true } }
      }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const comment = await prisma.taskComment.create({
      data: {
        content: content.trim(),
        taskId: id,
        userId: session.user.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    // Create notification for task owner/assignee if commenter is different
    const notifyUserIds: string[] = []
    if (task.userId !== session.user.id) {
      notifyUserIds.push(task.userId)
    }
    if (task.assignedToId && task.assignedToId !== session.user.id) {
      notifyUserIds.push(task.assignedToId)
    }

    if (notifyUserIds.length > 0) {
      await prisma.notification.createMany({
        data: notifyUserIds.map(userId => ({
          type: "TASK_COMMENT" as any,
          title: "Nowy komentarz",
          message: `${session.user.name || session.user.email} skomentował zadanie "${task.title}"`,
          userId,
          metadata: { taskId: id, commentId: comment.id }
        }))
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
