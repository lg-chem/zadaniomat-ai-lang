import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") || "WORK"

    // Get strategic categories
    const strategicCategories = await prisma.category.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
        isStrategic: true,
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
      orderBy: { name: "asc" },
    })

    // Auto-sync: create KnowledgeCategory for each strategic category if not exists
    for (const stratCat of strategicCategories) {
      const existing = await prisma.knowledgeCategory.findFirst({
        where: {
          userId: session.user.id,
          workspaceType: workspace as "WORK" | "PRIVATE",
          linkedCategoryId: stratCat.id,
        },
      })

      if (!existing) {
        await prisma.knowledgeCategory.create({
          data: {
            name: stratCat.name,
            color: stratCat.color,
            workspaceType: workspace as "WORK" | "PRIVATE",
            userId: session.user.id,
            linkedCategoryId: stratCat.id,
            isDefault: false,
            order: 0,
          },
        })
      } else if (existing.name !== stratCat.name || existing.color !== stratCat.color) {
        // Update if name or color changed
        await prisma.knowledgeCategory.update({
          where: { id: existing.id },
          data: {
            name: stratCat.name,
            color: stratCat.color,
          },
        })
      }
    }

    // Get knowledge categories linked to strategic categories (with entry counts)
    const categories = await prisma.knowledgeCategory.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
        linkedCategoryId: { not: null },
      },
      include: {
        linkedCategory: true,
        _count: {
          select: { entries: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ categories, strategicCategories })
  } catch (error) {
    console.error("Error fetching knowledge categories:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, color, icon, workspace, linkedCategoryId, parentId } = body

    if (!name) {
      return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 })
    }

    // If parentId provided, verify it exists and belongs to user
    if (parentId) {
      const parent = await prisma.knowledgeCategory.findFirst({
        where: {
          id: parentId,
          userId: session.user.id,
        },
      })
      if (!parent) {
        return NextResponse.json({ error: "Kategoria nadrzędna nie znaleziona" }, { status: 404 })
      }
    }

    // Get max order within the same parent
    const maxOrder = await prisma.knowledgeCategory.findFirst({
      where: {
        userId: session.user.id,
        workspaceType: workspace || "WORK",
        parentId: parentId || null,
      },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const category = await prisma.knowledgeCategory.create({
      data: {
        name,
        description,
        color: color || "#6366f1",
        icon,
        workspaceType: workspace || "WORK",
        userId: session.user.id,
        linkedCategoryId,
        parentId,
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: {
        linkedCategory: true,
        children: true,
        _count: {
          select: { entries: true },
        },
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Error creating knowledge category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
