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

    // Get user's own strategic categories
    const ownStrategicCategories = await prisma.category.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
        isStrategic: true,
      },
      select: {
        id: true,
        name: true,
        color: true,
        organizationId: true,
      },
      orderBy: { name: "asc" },
    })

    // Get team categories assigned to this user via OrganizationMemberCategory
    const teamMemberships = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        assignedCategories: {
          include: {
            category: true,
          },
        },
      },
    })

    // Collect team strategic categories assigned to user
    const teamStrategicCategories: { id: string; name: string; color: string; organizationId: string | null }[] = []
    for (const membership of teamMemberships) {
      for (const assignedCat of membership.assignedCategories) {
        const cat = assignedCat.category
        // Only include strategic team categories not owned by user
        if (cat.isStrategic && cat.userId !== session.user.id && cat.organizationId) {
          teamStrategicCategories.push({
            id: cat.id,
            name: cat.name,
            color: cat.color,
            organizationId: cat.organizationId,
          })
        }
      }
    }

    // Combine own + team strategic categories
    const allStrategicCategories = [...ownStrategicCategories, ...teamStrategicCategories]

    // Auto-sync: create KnowledgeCategory for each strategic category if not exists
    for (const stratCat of allStrategicCategories) {
      const existing = await prisma.knowledgeCategory.findFirst({
        where: {
          userId: session.user.id,
          workspaceType: workspace as "WORK" | "PRIVATE",
          linkedCategoryId: stratCat.id,
          parentId: null, // Only top-level
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

    // Helper function to build category tree
    const buildCategoryTree = (categories: any[], parentId: string | null = null): any[] => {
      return categories
        .filter(cat => cat.parentId === parentId)
        .map(cat => ({
          ...cat,
          children: buildCategoryTree(categories, cat.id),
        }))
    }

    // Get all knowledge categories (flat)
    const allCategories = await prisma.knowledgeCategory.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
      },
      include: {
        linkedCategory: true,
        _count: {
          select: { entries: true },
        },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    })

    // Build trees
    const strategicCats = buildCategoryTree(
      allCategories.filter(c => c.linkedCategoryId !== null)
    )
    const customCats = buildCategoryTree(
      allCategories.filter(c => c.linkedCategoryId === null)
    )

    return NextResponse.json({
      strategicCategories: strategicCats,
      customCategories: customCats,
      allCategories, // Flat list for selects
    })
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
    const { name, description, color, workspace, parentId } = body

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
        workspaceType: workspace || "WORK",
        userId: session.user.id,
        parentId: parentId || null,
        linkedCategoryId: null, // Custom categories are not linked
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: {
        linkedCategory: true,
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
