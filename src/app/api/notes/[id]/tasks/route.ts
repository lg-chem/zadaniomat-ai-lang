import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isValidDay, isValidTime } from "@/lib/calendar"
import { normalizeRichText } from "@/lib/rich-text"
import { ownedCategoryId } from "@/lib/quarter-schemas"

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(500_000).nullish(),
  scheduledDate: z.string().refine(isValidDay).nullish(),
  scheduledTime: z.string().refine(isValidTime).nullish(),
  plannedMinutes: z.number().int().min(1).max(24 * 60).nullish(),
  categoryId: z.string().nullish(),
})

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

    const parsed = createTaskSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane zadania" }, { status: 400 })
    }
    const input = parsed.data
    const description = normalizeRichText(input.description)

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description,
        descriptionUpdatedAt: description ? new Date() : null,
        scheduledDate: input.scheduledDate ? new Date(`${input.scheduledDate}T00:00:00.000Z`) : null,
        scheduledTime: input.scheduledTime || null,
        plannedMinutes: input.plannedMinutes ?? 25,
        categoryId: await ownedCategoryId(userId, input.categoryId ?? null),
        workspaceType: note.workspaceType,
        status: "NEW",
        metadata: { noteId: note.id },
        userId,
      },
      select: { id: true, title: true, status: true, scheduledDate: true, scheduledTime: true },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Error creating task from note:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
