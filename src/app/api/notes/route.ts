import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { normalizeRichText } from "@/lib/rich-text"

const toWorkspace = (value: unknown) => (value === "PRIVATE" ? "PRIVATE" : "WORK")

const createNoteSchema = z.object({
  // Set by the phone for a note written offline - sending it again doesn't make a copy
  id: z.string().regex(/^[a-z0-9]{20,40}$/).optional(),
  title: z.string().trim().max(300).optional(),
  content: z.string().max(500_000).nullish(),
  isPinned: z.boolean().optional(),
  workspaceType: z.string().optional(),
  // When a note written offline was written
  createdAt: z.iso.datetime().optional(),
})

// Time a note written offline was written - never in the future or very old
const MAX_OFFLINE_AGE_MS = 60 * 24 * 60 * 60 * 1000
function writtenAt(value: string | undefined) {
  const now = Date.now()
  const time = value ? Date.parse(value) : NaN
  if (Number.isNaN(time) || time > now || time < now - MAX_OFFLINE_AGE_MS) return undefined
  return new Date(time)
}

// GET - notes of the workspace, pinned first, then most recently changed (?q= searches)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceType = toWorkspace(searchParams.get("workspace"))
    const q = searchParams.get("q")?.trim()

    const notes = await prisma.note.findMany({
      where: {
        userId: session.user.id,
        workspaceType,
        ...(q && {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { content: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: 200,
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error("Error fetching notes:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - new note
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = createNoteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane notatki" }, { status: 400 })
    }
    const input = parsed.data
    const userId = session.user.id

    // A note sent again (offline sync retried) gets the latest text instead of a copy
    const updateSent = async (id: string) => {
      const existing = await prisma.note.findUnique({ where: { id } })
      if (!existing) return null
      if (existing.userId !== userId) return NextResponse.json({ error: "Conflict" }, { status: 409 })
      const updated = await prisma.note.update({
        where: { id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.content !== undefined && { content: normalizeRichText(input.content) }),
          ...(input.isPinned !== undefined && { isPinned: input.isPinned }),
        },
      })
      return NextResponse.json(updated)
    }

    if (input.id) {
      const sent = await updateSent(input.id)
      if (sent) return sent
    }

    const created = writtenAt(input.createdAt)
    try {
      const note = await prisma.note.create({
        data: {
          ...(input.id && { id: input.id }),
          title: input.title ?? "",
          content: normalizeRichText(input.content),
          isPinned: input.isPinned ?? false,
          workspaceType: toWorkspace(input.workspaceType),
          userId,
          ...(created && { createdAt: created, updatedAt: created }),
        },
      })
      return NextResponse.json(note, { status: 201 })
    } catch (error) {
      // The same note arrived twice at once - the other request created it
      if (input.id && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const sent = await updateSent(input.id)
        if (sent) return sent
      }
      throw error
    }
  } catch (error) {
    console.error("Error creating note:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
