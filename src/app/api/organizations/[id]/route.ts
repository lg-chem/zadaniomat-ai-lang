import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Get single organization
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

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
            assignedCategories: {
              include: { category: true }
            }
          }
        },
        // Use new many-to-many relation instead of deprecated 'categories'
        categoryLinks: {
          include: {
            category: {
              include: {
                _count: { select: { tasks: true } }
              }
            }
          },
          orderBy: { category: { order: "asc" } }
        },
        _count: { select: { tasks: true, members: true } }
      }
    })

    if (!organization) {
      return NextResponse.json({ error: "Zespół nie znaleziony" }, { status: 404 })
    }

    // Check if user has access (owner or member)
    const isMember = organization.members.some(m => m.userId === session.user.id)
    const isOwner = organization.ownerId === session.user.id

    if (!isMember && !isOwner) {
      return NextResponse.json({ error: "Brak dostępu" }, { status: 403 })
    }

    // Transform categoryLinks to categories array for frontend compatibility
    const categories = organization.categoryLinks.map(link => link.category)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { categoryLinks, ...orgWithoutLinks } = organization

    return NextResponse.json({ ...orgWithoutLinks, categories, isOwner })
  } catch (error) {
    console.error("Error fetching organization:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH - Update organization
export async function PATCH(
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
    const { name, description } = body

    // Check ownership
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { ownerId: true }
    })

    if (!organization) {
      return NextResponse.json({ error: "Zespół nie znaleziony" }, { status: 404 })
    }

    if (organization.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Tylko właściciel może edytować zespół" }, { status: 403 })
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description })
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

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating organization:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - Delete organization
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check ownership
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { ownerId: true }
    })

    if (!organization) {
      return NextResponse.json({ error: "Zespół nie znaleziony" }, { status: 404 })
    }

    if (organization.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Tylko właściciel może usunąć zespół" }, { status: 403 })
    }

    await prisma.organization.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting organization:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
