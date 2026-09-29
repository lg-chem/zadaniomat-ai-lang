import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { normalizeRichText } from "@/lib/rich-text"

const toWorkspace = (value: unknown) => (value === "PRIVATE" ? "PRIVATE" : "WORK")

const createNoteSchema = z.object({
  title: z.string().trim().max(300).optional(),
  content: z.string().max(500_000).nullish(),
  isPinned: z.boolean().optional(),
  workspaceType: z.string().optional(),
})

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

    const note = await prisma.note.create({
      data: {
        title: input.title ?? "",
        content: normalizeRichText(input.content),
        isPinned: input.isPinned ?? false,
        workspaceType: toWorkspace(input.workspaceType),
        userId: session.user.id,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error("Error creating note:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
