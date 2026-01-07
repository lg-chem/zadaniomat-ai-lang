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

    // Collect team strategic category IDs
    const teamCategoryIds: string[] = []
    for (const membership of teamMemberships) {
      for (const assignedCat of membership.assignedCategories) {
        const cat = assignedCat.category
        if (cat.isStrategic && cat.organizationId) {
          teamCategoryIds.push(cat.id)
        }
      }
    }

    // Get knowledge category IDs linked to team categories
    const teamKnowledgeCategories = await prisma.knowledgeCategory.findMany({
      where: {
        linkedCategoryId: { in: teamCategoryIds },
      },
      select: { id: true },
    })
    const teamKnowledgeCategoryIds = teamKnowledgeCategories.map(c => c.id)

    // Build the where clause
    const baseSearch = search ? {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { content: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}

    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        workspaceType: workspace as "WORK" | "PRIVATE",
        ...(categoryId && { categoryId }),
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
