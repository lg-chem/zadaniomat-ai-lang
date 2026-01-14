import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - List organizations (owned and member of)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get organizations where user is owner
    const ownedOrganizations = await prisma.organization.findMany({
      where: { ownerId: session.user.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
            assignedCategories: {
              include: { category: true }
            }
          }
        },
        // Use new many-to-many relation
        categoryLinks: {
          include: {
            category: {
              include: {
                _count: { select: { tasks: true } }
              }
            }
          }
        },
        _count: { select: { tasks: true, members: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    // Get organizations where user is a member (not owner)
    const memberOrganizations = await prisma.organization.findMany({
      where: {
        members: {
          some: { userId: session.user.id }
        },
        NOT: { ownerId: session.user.id }
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
            assignedCategories: {
              include: { category: true }
            }
          }
        },
        // Use new many-to-many relation
        categoryLinks: {
          include: {
            category: {
              include: {
                _count: { select: { tasks: true } }
              }
            }
          }
        },
        _count: { select: { tasks: true, members: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    // Transform categoryLinks to categories array for frontend compatibility
    const transformOrg = (org: typeof ownedOrganizations[0]) => {
      const categories = org.categoryLinks.map(link => link.category)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { categoryLinks, ...rest } = org
      return { ...rest, categories }
    }

    return NextResponse.json({
      owned: ownedOrganizations.map(transformOrg),
      memberOf: memberOrganizations.map(transformOrg)
    })
  } catch (error) {
    console.error("Error fetching organizations:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - Create a new organization (ADMIN or SUPER_ADMIN only)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has ADMIN or SUPER_ADMIN role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { error: "Tylko administratorzy mogą tworzyć zespoły" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: "Nazwa zespołu jest wymagana" }, { status: 400 })
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        description,
        ownerId: session.user.id,
        // Auto-add owner as a member with OWNER role
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER"
          }
        }
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    })

    return NextResponse.json(organization, { status: 201 })
  } catch (error) {
    console.error("Error creating organization:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
