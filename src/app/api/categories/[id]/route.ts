import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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

    const existingCategory = await prisma.category.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    const { name, color, icon, isStrategic, organizationId, memberIds } = body

    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (isStrategic !== undefined) updateData.isStrategic = isStrategic

    // Handle sharing with organization
    if (organizationId !== undefined) {
      if (organizationId === null) {
        // Unshare - remove organization link and all member assignments
        updateData.organizationId = null
        await prisma.organizationMemberCategory.deleteMany({
          where: { categoryId: id }
        })
      } else {
        // Verify user owns this organization
        const org = await prisma.organization.findFirst({
          where: { id: organizationId, ownerId: session.user.id }
        })
        if (!org) {
          return NextResponse.json({ error: "Nie jesteś właścicielem tego zespołu" }, { status: 403 })
        }
        updateData.organizationId = organizationId

        // If memberIds provided, assign category to those members
        if (memberIds && Array.isArray(memberIds)) {
          // First remove existing assignments for this category
          await prisma.organizationMemberCategory.deleteMany({
            where: { categoryId: id }
          })

          // Get organization members
          const members = await prisma.organizationMember.findMany({
            where: {
              organizationId,
              userId: { in: memberIds }
            }
          })

          // Create new assignments
          if (members.length > 0) {
            await prisma.organizationMemberCategory.createMany({
              data: members.map(m => ({
                memberId: m.id,
                categoryId: id
              }))
            })
          }
        }
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        organization: { select: { id: true, name: true } },
        assignedMembers: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error("Error updating category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

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

    const existingCategory = await prisma.category.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    await prisma.category.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
