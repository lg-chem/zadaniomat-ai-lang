import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Types for knowledge categories
interface KnowledgeCategoryBase {
  id: string
  name: string
  color: string
  description?: string | null
  parentId: string | null
  linkedCategoryId: string | null
  order: number
  linkedCategory?: {
    id: string
    name: string
    color: string
  } | null
  _count?: {
    entries: number
  }
}

interface KnowledgeCategoryWithChildren extends KnowledgeCategoryBase {
  children: KnowledgeCategoryWithChildren[]
}

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

    // Get team categories assigned to this user via OrganizationMemberCategory (legacy)
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

    // Also get categories shared via new many-to-many CategoryOrganization
    const sharedCategoriesViaOrg = await prisma.category.findMany({
      where: {
        userId: { not: session.user.id },
        isStrategic: true,
        workspaceType: workspace as "WORK" | "PRIVATE",
        organizations: {
          some: {
            organization: {
              members: {
                some: {
                  userId: session.user.id
                }
              }
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    })

    // Collect team strategic categories assigned to user (legacy way)
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

    // Add categories from new many-to-many (avoid duplicates)
    const existingIds = new Set([...ownStrategicCategories.map(c => c.id), ...teamStrategicCategories.map(c => c.id)])
    for (const cat of sharedCategoriesViaOrg) {
      if (!existingIds.has(cat.id)) {
        teamStrategicCategories.push({
          id: cat.id,
          name: cat.name,
          color: cat.color,
          organizationId: null,
        })
      }
    }

    // Combine own + team strategic categories
    const allStrategicCategories = [...ownStrategicCategories, ...teamStrategicCategories]

    // Auto-sync: create/update KnowledgeCategory for each strategic category (BATCH - no N+1)
    // First, get all existing knowledge categories linked to strategic categories in ONE query
    const existingKnowledgeCategories = await prisma.knowledgeCategory.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
        linkedCategoryId: { in: allStrategicCategories.map(c => c.id) },
        parentId: null,
      },
      select: {
        id: true,
        linkedCategoryId: true,
        name: true,
        color: true,
      },
    })

    // Create a map for quick lookup
    const existingByLinkedId = new Map(
      existingKnowledgeCategories.map(c => [c.linkedCategoryId, c])
    )

    // Separate categories to create vs update
    const toCreate: { name: string; color: string; linkedCategoryId: string }[] = []
    const toUpdate: { id: string; name: string; color: string }[] = []

    for (const stratCat of allStrategicCategories) {
      const existing = existingByLinkedId.get(stratCat.id)
      if (!existing) {
        toCreate.push({
          name: stratCat.name,
          color: stratCat.color,
          linkedCategoryId: stratCat.id,
        })
      } else if (existing.name !== stratCat.name || existing.color !== stratCat.color) {
        toUpdate.push({
          id: existing.id,
          name: stratCat.name,
          color: stratCat.color,
        })
      }
    }

    // Batch create new categories
    if (toCreate.length > 0) {
      await prisma.knowledgeCategory.createMany({
        data: toCreate.map(c => ({
          name: c.name,
          color: c.color,
          workspaceType: workspace as "WORK" | "PRIVATE",
          userId: session.user.id,
          linkedCategoryId: c.linkedCategoryId,
          isDefault: false,
          order: 0,
        })),
      })
    }

    // Batch update changed categories (Prisma doesn't support updateMany with different values, so use transaction)
    if (toUpdate.length > 0) {
      await prisma.$transaction(
        toUpdate.map(c =>
          prisma.knowledgeCategory.update({
            where: { id: c.id },
            data: { name: c.name, color: c.color },
          })
        )
      )
    }

    // Helper function to build category tree (typed, no any)
    const buildCategoryTree = (
      categories: KnowledgeCategoryBase[],
      parentId: string | null = null
    ): KnowledgeCategoryWithChildren[] => {
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
