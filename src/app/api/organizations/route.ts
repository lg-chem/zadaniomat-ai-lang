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
            user: { select: { id: true, name: true, email: true } },
            assignedCategories: {
              include: { category: true }
            }
          }
        },
        categories: true,
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
          where: { userId: session.user.id },
          include: {
            assignedCategories: {
              include: { category: true }
            }
          }
        },
        _count: { select: { tasks: true, members: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({
      owned: ownedOrganizations,
      memberOf: memberOrganizations
    })
  } catch (error) {
    console.error("Error fetching organizations:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - Create a new organization
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
