import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
  entryContent,
  entryInclude,
  hasEntryText,
  ownsKnowledgeCategory,
  reindexEntry,
  stepRows,
  updateEntrySchema,
} from "@/lib/knowledge"

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const entry = await prisma.knowledgeEntry.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        category: true,
        steps: {
          orderBy: { order: "asc" },
        },
      },
    })

    if (!entry) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    return NextResponse.json(entry)
  } catch (error) {
    console.error("Error fetching knowledge entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const parsed = updateEntrySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane wpisu" }, { status: 400 })
    }
    const { title, content, categoryId, isImportant, visibility, type, tags, steps, autosave, snapshot, reindex } =
      parsed.data

    // Verify entry belongs to user
    const existing = await prisma.knowledgeEntry.findFirst({
      where: {
        id: params.id,
        userId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    if (categoryId !== undefined && categoryId !== existing.categoryId && !(await ownsKnowledgeCategory(userId, categoryId))) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    const nextContent = content !== undefined ? entryContent(content) : undefined
    if (!hasEntryText(title ?? existing.title, nextContent ?? existing.content)) {
      return NextResponse.json({ error: "Wpis musi mieć tytuł albo treść" }, { status: 400 })
    }

    const isContentChange =
      (title !== undefined && title !== existing.title) || (nextContent !== undefined && nextContent !== existing.content)
    // While typing, the version from the start of writing is kept - not one per keystroke
    const saveVersion = isContentChange && snapshot !== false

    const entry = await prisma.$transaction(async (tx) => {
      if (saveVersion) {
        await tx.knowledgeEntryVersion.create({
          data: {
            entryId: params.id,
            version: existing.currentVersion,
            title: existing.title,
            content: existing.content,
            tags: existing.tags,
            changeType: "updated",
            changedById: userId,
          },
        })
      }

      // Steps are sent as the whole list
      if (steps !== undefined) {
        await tx.knowledgeStep.deleteMany({ where: { entryId: params.id } })
        const rows = stepRows(steps)
        if (rows.length > 0) {
          await tx.knowledgeStep.createMany({ data: rows.map((row) => ({ ...row, entryId: params.id })) })
        }
      }

      return tx.knowledgeEntry.update({
        where: { id: params.id },
        data: {
          ...(title !== undefined && { title }),
          ...(nextContent !== undefined && { content: nextContent }),
          ...(categoryId !== undefined && { categoryId }),
          ...(isImportant !== undefined && { isImportant }),
          ...(visibility !== undefined && { visibility }),
          ...(type !== undefined && { type }),
          ...(tags !== undefined && { tags }),
          ...(saveVersion && { currentVersion: { increment: 1 } }),
        },
        include: entryInclude,
      })
    })

    if (reindex || (isContentChange && !autosave)) reindexEntry(entry)

    return NextResponse.json(entry)
  } catch (error) {
    console.error("Error updating knowledge entry:", error)
    return NextResponse.json({ error: "Nie udało się zapisać wpisu" }, { status: 500 })
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

    // Verify entry belongs to user
    const entry = await prisma.knowledgeEntry.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!entry) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    await prisma.knowledgeEntry.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting knowledge entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
