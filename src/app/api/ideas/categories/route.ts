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
    const organizationId = searchParams.get("organizationId")

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 })
    }

    // Verify user is member of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    // Auto-sync: Get team's strategic categories and create IdeaCategories if not exist
    // Check both legacy organizationId AND new CategoryOrganization junction
    const teamStrategicCategories = await prisma.category.findMany({
      where: {
        isStrategic: true,
        workspaceType: "WORK",
        OR: [
          { organizationId },
          {
            organizations: {
              some: {
                organizationId
              }
            }
          }
        ]
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    })

    // Sync each strategic category to IdeaCategory
    for (const stratCat of teamStrategicCategories) {
      const existing = await prisma.ideaCategory.findFirst({
        where: {
          organizationId,
          linkedCategoryId: stratCat.id,
        },
      })

      if (!existing) {
        // Create IdeaCategory linked to strategic category
        await prisma.ideaCategory.create({
          data: {
            name: stratCat.name,
            color: stratCat.color,
            organizationId,
            linkedCategoryId: stratCat.id,
            order: stratCat.order,
          },
        })
      } else if (existing.name !== stratCat.name || existing.color !== stratCat.color) {
        // Update if name or color changed
        await prisma.ideaCategory.update({
          where: { id: existing.id },
          data: {
            name: stratCat.name,
            color: stratCat.color,
          },
        })
      }
    }

    const categories = await prisma.ideaCategory.findMany({
      where: {
        organizationId,
      },
      include: {
        _count: {
          select: { ideas: true },
        },
        linkedCategory: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching idea categories:", error)
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
    const { name, color, emoji, organizationId } = body

    if (!name || !organizationId) {
      return NextResponse.json(
        { error: "Nazwa i zespół są wymagane" },
        { status: 400 }
      )
    }

    // Verify user is owner of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: "OWNER",
      },
    })

    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        ownerId: session.user.id,
      },
    })

    if (!membership && !organization) {
      return NextResponse.json(
        { error: "Tylko admin może tworzyć kategorie" },
        { status: 403 }
      )
    }

    const category = await prisma.ideaCategory.create({
      data: {
        name,
        color: color || "#8b5cf6",
        emoji,
        organizationId,
      },
      include: {
        _count: {
          select: { ideas: true },
        },
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Error creating idea category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
