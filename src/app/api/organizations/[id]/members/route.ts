import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - List members of organization
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

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        assignedCategories: {
          include: { category: true }
        }
      },
      orderBy: [
        { role: "asc" }, // OWNER first
        { joinedAt: "asc" }
      ]
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error("Error fetching members:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - Add member to organization (by email)
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
    const { email, categoryIds } = body

    if (!email) {
      return NextResponse.json({ error: "Email jest wymagany" }, { status: 400 })
    }

    // Check ownership
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { ownerId: true, name: true }
    })

    if (!organization) {
      return NextResponse.json({ error: "Zespół nie znaleziony" }, { status: 404 })
    }

    if (organization.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Tylko właściciel może dodawać członków" }, { status: 403 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true }
    })

    if (!user) {
      return NextResponse.json({ error: "Użytkownik o tym emailu nie istnieje" }, { status: 404 })
    }

    // Check if already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: id,
          userId: user.id
        }
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: "Użytkownik jest już członkiem zespołu" }, { status: 400 })
    }

    // Add member
    const member = await prisma.organizationMember.create({
      data: {
        organizationId: id,
        userId: user.id,
        role: "MEMBER",
        // Assign categories if provided
        assignedCategories: categoryIds?.length ? {
          create: categoryIds.map((categoryId: string) => ({
            categoryId
          }))
        } : undefined
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        assignedCategories: {
          include: { category: true }
        }
      }
    })

    // Create notification for the new member
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "MEMBER_JOINED",
        title: "Dodano do zespołu",
        message: `Zostałeś dodany do zespołu "${organization.name}"`,
        metadata: { organizationId: id }
      }
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error("Error adding member:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
