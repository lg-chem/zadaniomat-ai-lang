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

    const { name, color, icon, isStrategic, organizationId, organizationIds, memberIds } = body

    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (isStrategic !== undefined) updateData.isStrategic = isStrategic

    // Handle sharing with organizations (new many-to-many approach)
    if (organizationIds !== undefined && Array.isArray(organizationIds)) {
      // Verify user owns all these organizations
      const ownedOrgs = await prisma.organization.findMany({
        where: {
          id: { in: organizationIds },
          ownerId: session.user.id
        },
        select: { id: true }
      })

      const ownedOrgIds = new Set(ownedOrgs.map(o => o.id))
      const invalidOrgs = organizationIds.filter((orgId: string) => !ownedOrgIds.has(orgId))

      if (invalidOrgs.length > 0) {
        return NextResponse.json({ error: "Nie jesteś właścicielem wszystkich wybranych zespołów" }, { status: 403 })
      }

      // Remove existing organization links
      await prisma.categoryOrganization.deleteMany({
        where: { categoryId: id }
      })

      // Add new organization links
      if (organizationIds.length > 0) {
        await prisma.categoryOrganization.createMany({
          data: organizationIds.map((orgId: string) => ({
            categoryId: id,
            organizationId: orgId
          }))
        })
      }

      // Handle member assignments if provided
      if (memberIds && Array.isArray(memberIds) && organizationIds.length > 0) {
        // Remove existing member assignments for this category
        await prisma.organizationMemberCategory.deleteMany({
          where: { categoryId: id }
        })

        // Get members from all organizations that match the memberIds
        const members = await prisma.organizationMember.findMany({
          where: {
            organizationId: { in: organizationIds },
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

      // Clear old single organizationId field
      updateData.organizationId = null
    }
    // Backward compatibility: handle single organizationId
    else if (organizationId !== undefined) {
      if (organizationId === null) {
        // Unshare - remove organization link and all member assignments
        updateData.organizationId = null
        await prisma.organizationMemberCategory.deleteMany({
          where: { categoryId: id }
        })
        await prisma.categoryOrganization.deleteMany({
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

        // Use new many-to-many table
        await prisma.categoryOrganization.deleteMany({
          where: { categoryId: id }
        })
        await prisma.categoryOrganization.create({
          data: { categoryId: id, organizationId }
        })

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
