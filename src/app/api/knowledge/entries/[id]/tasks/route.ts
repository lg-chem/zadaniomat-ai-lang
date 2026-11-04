import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { createTaskFromText, taskFromTextSchema } from "@/lib/task-from-text"
import { findReadableEntry } from "@/lib/knowledge"

// GET - own tasks made from this knowledge entry
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const entry = await findReadableEntry(userId, params.id)
    if (!entry) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        metadata: { path: ["knowledgeEntryId"], equals: entry.id },
      },
      select: { id: true, title: true, status: true, scheduledDate: true, scheduledTime: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching tasks of knowledge entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - own task made from a knowledge entry, a fragment of it or one of its steps
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const entry = await findReadableEntry(userId, params.id)
    if (!entry) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    const parsed = taskFromTextSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane zadania" }, { status: 400 })
    }

    const task = await createTaskFromText(userId, parsed.data, {
      workspaceType: entry.workspaceType,
      metadata: { knowledgeEntryId: entry.id },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Error creating task from knowledge entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
