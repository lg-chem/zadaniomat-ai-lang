import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Get single member details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, memberId } = await params

    const member = await prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: id
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        assignedCategories: {
          include: { category: true }
        },
        organization: {
          select: { ownerId: true }
        }
      }
    })

    if (!member) {
      return NextResponse.json({ error: "Członek nie znaleziony" }, { status: 404 })
    }

    // Check access
    const isOwner = member.organization.ownerId === session.user.id
    const isSelf = member.userId === session.user.id

    if (!isOwner && !isSelf) {
      return NextResponse.json({ error: "Brak dostępu" }, { status: 403 })
    }

    return NextResponse.json(member)
  } catch (error) {
    console.error("Error fetching member:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH - Update member (assign/unassign categories)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, memberId } = await params
    const body = await req.json()
    const { categoryIds } = body

    // Check ownership
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { ownerId: true }
    })

    if (!organization) {
      return NextResponse.json({ error: "Zespół nie znaleziony" }, { status: 404 })
    }

    if (organization.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Tylko właściciel może zarządzać członkami" }, { status: 403 })
    }

    // Check if member exists
    const member = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: id }
    })

    if (!member) {
      return NextResponse.json({ error: "Członek nie znaleziony" }, { status: 404 })
    }

    // Update assigned categories - delete existing and create new
    if (categoryIds !== undefined) {
      // Delete existing assignments
      await prisma.organizationMemberCategory.deleteMany({
        where: { memberId }
      })

      // Create new assignments
      if (categoryIds.length > 0) {
        await prisma.organizationMemberCategory.createMany({
          data: categoryIds.map((categoryId: string) => ({
            memberId,
            categoryId
          }))
        })
      }
    }

    // Fetch updated member
    const updatedMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        assignedCategories: {
          include: { category: true }
        }
      }
    })

    return NextResponse.json(updatedMember)
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - Remove member from organization
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, memberId } = await params

    // Get member and check
    const member = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: id },
      include: {
        organization: { select: { ownerId: true } },
        user: { select: { name: true } }
      }
    })

    if (!member) {
      return NextResponse.json({ error: "Członek nie znaleziony" }, { status: 404 })
    }

    const isOwner = member.organization.ownerId === session.user.id
    const isSelf = member.userId === session.user.id

    // Only owner can remove others, members can remove themselves
    if (!isOwner && !isSelf) {
      return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 })
    }

    // Cannot remove the owner
    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Nie można usunąć właściciela zespołu" }, { status: 400 })
    }

    // Remove member
    await prisma.organizationMember.delete({
      where: { id: memberId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
