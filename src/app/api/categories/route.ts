import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") as "WORK" | "PRIVATE" | null

    // Get user's own categories
    const ownWhere: Prisma.CategoryWhereInput = {
      userId: session.user.id,
      ...(workspace ? { workspaceType: workspace } : {})
    }

    const ownCategories = await prisma.category.findMany({
      where: ownWhere,
      include: {
        organization: { select: { id: true, name: true } }, // Legacy single org
        organizations: {
          include: {
            organization: { select: { id: true, name: true } }
          }
        },
        _count: { select: { tasks: true } }
      },
      orderBy: { order: "asc" },
    })

    // Get shared categories from organizations user is a member of (but not owner)
    // Check both legacy organizationId and new many-to-many organizations
    const sharedWhere: Prisma.CategoryWhereInput = {
      userId: { not: session.user.id },
      OR: [
        // Legacy: single organizationId
        {
          organizationId: { not: null },
          assignedMembers: {
            some: {
              member: {
                userId: session.user.id
              }
            }
          }
        },
        // New: many-to-many via CategoryOrganization
        {
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
        }
      ],
      ...(workspace ? { workspaceType: workspace } : {})
    }

    const sharedCategories = await prisma.category.findMany({
      where: sharedWhere,
      include: {
        organization: { select: { id: true, name: true } }, // Legacy
        organizations: {
          include: {
            organization: { select: { id: true, name: true } }
          }
        },
        user: { select: { id: true, name: true } },
        _count: { select: { tasks: true } }
      },
      orderBy: { order: "asc" },
    })

    // Mark shared categories
    // Check both legacy organizationId and new organizations array
    const categoriesWithSharedFlag = [
      ...ownCategories.map(c => ({
        ...c,
        isShared: !!c.organizationId || (c.organizations && c.organizations.length > 0),
        isOwner: true
      })),
      ...sharedCategories.map(c => ({ ...c, isShared: true, isOwner: false }))
    ]

    return NextResponse.json(categoriesWithSharedFlag)
  } catch (error) {
    console.error("Error fetching categories:", error)
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
    const { name, color, icon, isStrategic, workspaceType = "WORK" } = body

    if (!name) {
      return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 })
    }

    // Get max order
    const maxOrder = await prisma.category.findFirst({
      where: { userId: session.user.id, workspaceType },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const category = await prisma.category.create({
      data: {
        name,
        color: color || "#6366f1",
        icon,
        isStrategic: isStrategic || false,
        workspaceType,
        order: (maxOrder?.order || 0) + 1,
        userId: session.user.id,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Error creating category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
