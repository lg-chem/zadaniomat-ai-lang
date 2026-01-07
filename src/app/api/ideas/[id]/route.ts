import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { title, content, categoryId } = body

    // Get idea and verify ownership
    const idea = await prisma.idea.findUnique({
      where: { id },
    })

    if (!idea) {
      return NextResponse.json({ error: "Rozminka nie znaleziona" }, { status: 404 })
    }

    // Only the author can edit their idea
    if (idea.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Możesz edytować tylko swoje rozkminki" },
        { status: 403 }
      )
    }

    const updated = await prisma.idea.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(content !== undefined && { content }),
        ...(categoryId !== undefined && { categoryId }),
      },
      include: {
        category: {
          include: {
            linkedCategory: {
              select: {
                icon: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating idea:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get idea
    const idea = await prisma.idea.findUnique({
      where: { id },
      include: {
        category: {
          include: { organization: true },
        },
      },
    })

    if (!idea) {
      return NextResponse.json({ error: "Rozminka nie znaleziona" }, { status: 404 })
    }

    // Author can delete their own idea, admins can delete any
    const isAuthor = idea.userId === session.user.id
    const isOwner = idea.category.organization.ownerId === session.user.id

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: idea.category.organizationId,
        userId: session.user.id,
        role: "OWNER",
      },
    })

    if (!isAuthor && !isOwner && !membership) {
      return NextResponse.json(
        { error: "Nie masz uprawnień do usunięcia tej rozkminki" },
        { status: 403 }
      )
    }

    await prisma.idea.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting idea:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
