import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - List categories for organization
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check access
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: {
        ownerId: true,
        members: { select: { userId: true } }
      }
    })

    if (!organization) {
      return NextResponse.json({ error: "Zespół nie znaleziony" }, { status: 404 })
    }

    const isMember = organization.members.some(m => m.userId === session.user.id)
    const isOwner = organization.ownerId === session.user.id

    if (!isMember && !isOwner) {
      return NextResponse.json({ error: "Brak dostępu" }, { status: 403 })
    }

    // Get categories via both old organizationId AND new CategoryOrganization junction
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          // Legacy: direct organizationId
          { organizationId: id },
          // New: via CategoryOrganization junction table
          {
            organizations: {
              some: {
                organizationId: id
              }
            }
          }
        ]
      },
      include: {
        _count: { select: { tasks: true } },
        organizations: {
          include: {
            organization: { select: { id: true, name: true } }
          }
        },
        assignedMembers: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            }
          }
        }
      },
      orderBy: { order: "asc" }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching organization categories:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - Create category for organization
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, color, icon, isStrategic } = body

    if (!name) {
      return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 })
    }

    // Check ownership
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { ownerId: true }
    })

    if (!organization) {
      return NextResponse.json({ error: "Zespół nie znaleziony" }, { status: 404 })
    }

    if (organization.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Tylko właściciel może tworzyć kategorie zespołowe" }, { status: 403 })
    }

    // Get max order
    const maxOrder = await prisma.category.findFirst({
      where: { organizationId: id },
      orderBy: { order: "desc" },
      select: { order: true }
    })

    const category = await prisma.category.create({
      data: {
        name,
        color: color || "#6366f1",
        icon,
        isStrategic: isStrategic || false,
        workspaceType: "WORK", // Team categories are always WORK
        order: (maxOrder?.order || 0) + 1,
        userId: session.user.id, // Owner is the creator
        organizationId: id
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Error creating organization category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
