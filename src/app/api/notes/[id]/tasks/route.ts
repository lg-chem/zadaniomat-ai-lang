import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { createTaskFromText, taskFromTextSchema } from "@/lib/task-from-text"

// POST - task made from a note (or a fragment of it); the note stays, the task remembers it
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

    const note = await prisma.note.findFirst({ where: { id: params.id, userId } })
    if (!note) {
      return NextResponse.json({ error: "Notatka nie znaleziona" }, { status: 404 })
    }

    const parsed = taskFromTextSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane zadania" }, { status: 400 })
    }

    const task = await createTaskFromText(userId, parsed.data, {
      workspaceType: note.workspaceType,
      metadata: { noteId: note.id },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Error creating task from note:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
