import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { normalizeRichText } from "@/lib/rich-text"

const updateNoteSchema = z.object({
  title: z.string().trim().max(300).optional(),
  content: z.string().max(500_000).nullish(),
  isPinned: z.boolean().optional(),
})

async function findOwnedNote(userId: string, id: string) {
  return prisma.note.findFirst({ where: { id, userId } })
}

// GET - note with the tasks created from it
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const note = await findOwnedNote(session.user.id, params.id)
    if (!note) {
      return NextResponse.json({ error: "Notatka nie znaleziona" }, { status: 404 })
    }

    const tasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        metadata: { path: ["noteId"], equals: note.id },
      },
      select: { id: true, title: true, status: true, scheduledDate: true, scheduledTime: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ ...note, tasks })
  } catch (error) {
    console.error("Error fetching note:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH - title / content / pin
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const note = await findOwnedNote(session.user.id, params.id)
    if (!note) {
      return NextResponse.json({ error: "Notatka nie znaleziona" }, { status: 404 })
    }

    const parsed = updateNoteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane notatki" }, { status: 400 })
    }
    const input = parsed.data

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.content !== undefined && { content: normalizeRichText(input.content) }),
        ...(input.isPinned !== undefined && { isPinned: input.isPinned }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating note:", error)
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

    const note = await findOwnedNote(session.user.id, params.id)
    if (!note) {
      return NextResponse.json({ error: "Notatka nie znaleziona" }, { status: 404 })
    }

    await prisma.note.delete({ where: { id: note.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting note:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
