import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/knowledge/entries/[id]/versions - Get version history
export async function GET(
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
      select: { id: true, currentVersion: true },
    })

    if (!entry) {
      return NextResponse.json({ error: "Wpis nie znaleziony" }, { status: 404 })
    }

    const versions = await prisma.knowledgeEntryVersion.findMany({
      where: { entryId: params.id },
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { version: "desc" },
    })

    return NextResponse.json({
      currentVersion: entry.currentVersion,
      versions,
    })
  } catch (error) {
    console.error("Error fetching versions:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST /api/knowledge/entries/[id]/versions - Restore a specific version
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { versionId } = body

    if (!versionId) {
      return NextResponse.json({ error: "ID wersji jest wymagane" }, { status: 400 })
    }

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

    // Get the version to restore
    const versionToRestore = await prisma.knowledgeEntryVersion.findFirst({
      where: {
        id: versionId,
        entryId: params.id,
      },
    })

    if (!versionToRestore) {
      return NextResponse.json({ error: "Wersja nie znaleziona" }, { status: 404 })
    }

    // Save current state before restoring
    await prisma.knowledgeEntryVersion.create({
      data: {
        entryId: params.id,
        version: existing.currentVersion,
        title: existing.title,
        content: existing.content,
        tags: existing.tags,
        changeType: "restored",
        changedById: session.user.id,
      },
    })

    // Restore the version
    const entry = await prisma.knowledgeEntry.update({
      where: { id: params.id },
      data: {
        title: versionToRestore.title,
        content: versionToRestore.content,
        tags: versionToRestore.tags,
        currentVersion: { increment: 1 },
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

    return NextResponse.json({
      entry,
      message: `Przywrócono wersję ${versionToRestore.version}`,
    })
  } catch (error) {
    console.error("Error restoring version:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
