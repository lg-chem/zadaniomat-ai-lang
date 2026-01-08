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
    const categoryId = searchParams.get("categoryId")
    const search = searchParams.get("search")

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

    // Collect team strategic category IDs (legacy way)
    const teamCategoryIds: string[] = []
    for (const membership of teamMemberships) {
      for (const assignedCat of membership.assignedCategories) {
        const cat = assignedCat.category
        if (cat.isStrategic && cat.organizationId) {
          teamCategoryIds.push(cat.id)
        }
      }
    }

    // Also get categories shared via new many-to-many CategoryOrganization
    const categoriesViaOrg = await prisma.category.findMany({
      where: {
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
      select: { id: true }
    })

    // Add to teamCategoryIds (avoid duplicates)
    const existingIds = new Set(teamCategoryIds)
    for (const cat of categoriesViaOrg) {
      if (!existingIds.has(cat.id)) {
        teamCategoryIds.push(cat.id)
      }
    }

    // Get knowledge category IDs linked to team categories
    const teamKnowledgeCategories = await prisma.knowledgeCategory.findMany({
      where: {
        linkedCategoryId: { in: teamCategoryIds },
      },
      select: { id: true, linkedCategoryId: true },
    })
    const teamKnowledgeCategoryIds = teamKnowledgeCategories.map(c => c.id)

    // Build the where clause
    const baseSearch = search ? {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { content: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}

    // If filtering by categoryId, also include entries from other knowledge categories
    // that link to the same strategic category (for team sharing)
    let categoryFilter: { categoryId?: string | { in: string[] } } = {}
    if (categoryId) {
      // Get the selected category's linkedCategoryId
      const selectedCategory = await prisma.knowledgeCategory.findUnique({
        where: { id: categoryId },
        select: { linkedCategoryId: true },
      })

      if (selectedCategory?.linkedCategoryId) {
        // Find all knowledge categories that link to the same strategic category
        const relatedCategories = await prisma.knowledgeCategory.findMany({
          where: {
            linkedCategoryId: selectedCategory.linkedCategoryId,
          },
          select: { id: true },
        })
        const relatedCategoryIds = relatedCategories.map(c => c.id)
        categoryFilter = { categoryId: { in: relatedCategoryIds } }
      } else {
        // Custom category - just filter by exact categoryId
        categoryFilter = { categoryId }
      }
    }

    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        workspaceType: workspace as "WORK" | "PRIVATE",
        ...categoryFilter,
        ...baseSearch,
        // User's own entries OR team-shared entries in team categories
        OR: [
          { userId: session.user.id },
          {
            visibility: "TEAM",
            categoryId: { in: teamKnowledgeCategoryIds },
          },
        ],
      },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ isImportant: "desc" }, { updatedAt: "desc" }],
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error("Error fetching knowledge entries:", error)
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
    const { title, content, categoryId, workspace, isImportant, visibility } = body

    if (!title || !content || !categoryId) {
      return NextResponse.json(
        { error: "Tytuł, treść i kategoria są wymagane" },
        { status: 400 }
      )
    }

    // Verify category belongs to user
    const category = await prisma.knowledgeCategory.findFirst({
      where: {
        id: categoryId,
        userId: session.user.id,
      },
    })

    if (!category) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    const entry = await prisma.knowledgeEntry.create({
      data: {
        title,
        content,
        categoryId,
        workspaceType: workspace || "WORK",
        userId: session.user.id,
        isImportant: isImportant || false,
        visibility: visibility || "PRIVATE",
      },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error("Error creating knowledge entry:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
