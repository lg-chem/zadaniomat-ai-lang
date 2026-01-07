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

    const body = await req.json()
    const { name, color, emoji, order } = body

    // Get category and verify permissions
    const category = await prisma.ideaCategory.findUnique({
      where: { id: params.id },
      include: { organization: true },
    })

    if (!category) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    // Check if user is admin/owner
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: category.organizationId,
        userId: session.user.id,
        role: { in: ["OWNER", "ADMIN"] },
      },
    })

    const isOwner = category.organization.ownerId === session.user.id

    if (!membership && !isOwner) {
      return NextResponse.json(
        { error: "Tylko admin może edytować kategorie" },
        { status: 403 }
      )
    }

    const updated = await prisma.ideaCategory.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(emoji !== undefined && { emoji }),
        ...(order !== undefined && { order }),
      },
      include: {
        _count: {
          select: { ideas: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating idea category:", error)
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

    // Get category and verify permissions
    const category = await prisma.ideaCategory.findUnique({
      where: { id: params.id },
      include: { organization: true },
    })

    if (!category) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    // Check if user is admin/owner
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: category.organizationId,
        userId: session.user.id,
        role: { in: ["OWNER", "ADMIN"] },
      },
    })

    const isOwner = category.organization.ownerId === session.user.id

    if (!membership && !isOwner) {
      return NextResponse.json(
        { error: "Tylko admin może usuwać kategorie" },
        { status: 403 }
      )
    }

    await prisma.ideaCategory.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting idea category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
