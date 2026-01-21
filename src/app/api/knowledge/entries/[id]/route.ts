import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { updateKnowledgeEmbedding } from "@/lib/embeddings"
import { stripHtml } from "@/components/ui/rich-editor"

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

    const body = await req.json()
    const { title, content, categoryId, isImportant, visibility, type, tags, steps } = body

    // Verify entry belongs to user
    const existing = await prisma.knowledgeEntry.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    // Save current version to history if title or content is changing
    const isContentChange = (title !== undefined && title !== existing.title) ||
                           (content !== undefined && content !== existing.content)

    if (isContentChange) {
      await prisma.knowledgeEntryVersion.create({
        data: {
          entryId: params.id,
          version: existing.currentVersion,
          title: existing.title,
          content: existing.content,
          tags: existing.tags,
          changeType: "updated",
          changedById: session.user.id,
        },
      })
    }

    // If steps are provided, delete existing and create new ones
    if (steps !== undefined) {
      await prisma.knowledgeStep.deleteMany({
        where: { entryId: params.id },
      })

      if (steps.length > 0) {
        await prisma.knowledgeStep.createMany({
          data: steps.map((step: { title: string; description?: string; estimatedTime?: number; assignedRole?: string }, index: number) => ({
            entryId: params.id,
            order: index,
            title: step.title,
            description: step.description || null,
            estimatedTime: step.estimatedTime || null,
            assignedRole: step.assignedRole || null,
          })),
        })
      }
    }

    const entry = await prisma.knowledgeEntry.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(categoryId !== undefined && { categoryId }),
        ...(isImportant !== undefined && { isImportant }),
        ...(visibility !== undefined && { visibility }),
        ...(type !== undefined && { type }),
        ...(tags !== undefined && { tags }),
        // Increment version if content changed
        ...(isContentChange && { currentVersion: { increment: 1 } }),
      },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        steps: {
          orderBy: { order: "asc" },
        },
      },
    })

    // Update embedding if title or content changed
    // Strip HTML for cleaner embeddings
    if (title !== undefined || content !== undefined) {
      updateKnowledgeEmbedding(entry.id, `${stripHtml(entry.title)}\n\n${stripHtml(entry.content)}`).catch(err => {
        console.error("Error updating embedding:", err)
      })
    }

    return NextResponse.json(entry)
  } catch (error) {
    console.error("Error updating knowledge entry:", error)
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
