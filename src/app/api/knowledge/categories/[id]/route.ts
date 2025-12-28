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
    const { name, description, color, icon, order, linkedCategoryId } = body

    // Verify category belongs to user
    const existing = await prisma.knowledgeCategory.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    const category = await prisma.knowledgeCategory.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
        ...(linkedCategoryId !== undefined && { linkedCategoryId }),
      },
      include: {
        linkedCategory: true,
        _count: {
          select: { entries: true },
        },
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error("Error updating knowledge category:", error)
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

    // Verify category belongs to user and is not default
    const category = await prisma.knowledgeCategory.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!category) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    if (category.isDefault) {
      return NextResponse.json(
        { error: "Nie można usunąć domyślnej kategorii" },
        { status: 400 }
      )
    }

    // Delete all entries in this category first
    await prisma.knowledgeEntry.deleteMany({
      where: { categoryId: params.id },
    })

    await prisma.knowledgeCategory.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting knowledge category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
