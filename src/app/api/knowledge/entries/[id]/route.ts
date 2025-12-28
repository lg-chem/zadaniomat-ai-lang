import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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
    const { title, content, categoryId, isImportant } = body

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

    const entry = await prisma.knowledgeEntry.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(categoryId !== undefined && { categoryId }),
        ...(isImportant !== undefined && { isImportant }),
      },
      include: {
        category: true,
      },
    })

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
