import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { createTaskFromText, taskFromTextSchema } from "@/lib/task-from-text"

// Helper function to check if user can access a task (owner, assigned, or team admin)
async function canAccessTask(taskId: string, userId: string) {
  const ownTask = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [{ userId }, { assignedToId: userId }],
    },
  })
  if (ownTask) return ownTask

  const task = await prisma.task.findFirst({ where: { id: taskId } })
  if (!task) return null

  // Team owner can work with tasks of the team's members
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: task.userId,
      role: "MEMBER",
      organization: { ownerId: userId },
    },
  })

  return membership ? task : null
}

// POST - own task made from a line or fragment of this task's description
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    const { id } = await params

    const source = await canAccessTask(id, userId)
    if (!source) {
      return NextResponse.json({ error: "Zadanie nie znalezione" }, { status: 404 })
    }

    const parsed = taskFromTextSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane zadania" }, { status: 400 })
    }

    const task = await createTaskFromText(userId, parsed.data, {
      workspaceType: source.workspaceType,
      metadata: { sourceTaskId: source.id },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Error creating task from description:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
