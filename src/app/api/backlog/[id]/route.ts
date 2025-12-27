import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()

    const existing = await prisma.backlogItem.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const { content, priority, isProcessed } = body
    const updateData: Record<string, unknown> = {}

    if (content !== undefined) updateData.content = content
    if (priority !== undefined) updateData.priority = priority
    if (isProcessed !== undefined) {
      updateData.isProcessed = isProcessed
      if (isProcessed) {
        updateData.processedAt = new Date()
      }
    }

    const item = await prisma.backlogItem.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error("Error updating backlog item:", error)
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

    const { id } = params

    const existing = await prisma.backlogItem.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    await prisma.backlogItem.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting backlog item:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
