import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { searchKnowledge } from "@/lib/embeddings"
import {
  createEntrySchema,
  entryContent,
  entryInclude,
  hasEntryText,
  ownsKnowledgeCategory,
  reindexEntry,
  stepRows,
} from "@/lib/knowledge"

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
    const semantic = searchParams.get("semantic") === "true"

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

    // Semantic search mode - use AI embeddings
    if (semantic && search) {
      try {
        const semanticResults = await searchKnowledge(search, session.user.id, {
          limit: 50,
          workspaceType: workspace as "WORK" | "PRIVATE",
          includeTeamKnowledge: true,
          teamCategoryIds: teamKnowledgeCategoryIds,
        })

        // Get full entry data for the results
        const entryIds = semanticResults.map(r => r.id)
        const entries = await prisma.knowledgeEntry.findMany({
          where: {
            id: { in: entryIds },
          },
          include: entryInclude,
        })

        // Sort by similarity (maintain order from semantic search)
        const entryMap = new Map(entries.map(e => [e.id, e]))
        const sortedEntries = semanticResults
          .map(r => {
            const entry = entryMap.get(r.id)
            if (entry) {
              return { ...entry, similarity: r.similarity }
            }
            return null
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)

        return NextResponse.json(sortedEntries)
      } catch (error) {
        console.error("Semantic search failed, falling back to text search:", error)
        // Fall through to regular search
      }
    }

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
      include: entryInclude,
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
    const userId = session.user.id

    const parsed = createEntrySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane wpisu" }, { status: 400 })
    }
    const input = parsed.data

    if (!hasEntryText(input.title, input.content)) {
      return NextResponse.json({ error: "Wpisz tytuł albo treść" }, { status: 400 })
    }
    if (!(await ownsKnowledgeCategory(userId, input.categoryId))) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    const fields = {
      title: input.title ?? "",
      content: entryContent(input.content),
      categoryId: input.categoryId,
      isImportant: input.isImportant ?? false,
      visibility: input.visibility ?? "PRIVATE",
      type: input.type ?? "ARTICLE",
      tags: input.tags ?? [],
    }
    const steps = stepRows(input.steps ?? [])

    // Sent again (the first answer didn't arrive) - the entry is already there
    if (input.id) {
      const existing = await prisma.knowledgeEntry.findUnique({ where: { id: input.id } })
      if (existing) {
        if (existing.userId !== userId) {
          return NextResponse.json({ error: "Nieprawidłowe dane wpisu" }, { status: 400 })
        }
        const entry = await prisma.$transaction(async (tx) => {
          await tx.knowledgeStep.deleteMany({ where: { entryId: existing.id } })
          return tx.knowledgeEntry.update({
            where: { id: existing.id },
            data: { ...fields, ...(steps.length > 0 && { steps: { create: steps } }) },
            include: entryInclude,
          })
        })
        if (!input.autosave) reindexEntry(entry)
        return NextResponse.json(entry)
      }
    }

    const entry = await prisma.knowledgeEntry.create({
      data: {
        ...(input.id && { id: input.id }),
        ...fields,
        workspaceType: input.workspace ?? "WORK",
        userId,
        ...(steps.length > 0 && { steps: { create: steps } }),
      },
      include: entryInclude,
    })

    // While typing the index is refreshed once writing ends
    if (!input.autosave) reindexEntry(entry)

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error("Error creating knowledge entry:", error)
    return NextResponse.json({ error: "Nie udało się zapisać wpisu" }, { status: 500 })
  }
}
