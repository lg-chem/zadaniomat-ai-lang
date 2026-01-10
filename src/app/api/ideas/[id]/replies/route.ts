import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: ideaId } = await params

    // Get idea with category to check organization membership
    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        category: {
          select: { organizationId: true },
        },
      },
    })

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 })
    }

    // Check if user is owner of organization
    const organization = await prisma.organization.findUnique({
      where: { id: idea.category.organizationId },
      select: { ownerId: true },
    })

    const isOwner = organization?.ownerId === session.user.id

    // Verify user is member of this organization (or owner)
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: idea.category.organizationId,
        userId: session.user.id,
      },
    })

    if (!membership && !isOwner) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    const replies = await prisma.ideaReply.findMany({
      where: { ideaId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(replies)
  } catch (error) {
    console.error("Error fetching idea replies:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: ideaId } = await params
    const body = await req.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Treść jest wymagana" }, { status: 400 })
    }

    // Get idea with category to check organization membership
    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        category: {
          select: { organizationId: true },
        },
      },
    })

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 })
    }

    // Check if user is owner of organization
    const organization = await prisma.organization.findUnique({
      where: { id: idea.category.organizationId },
      select: { ownerId: true },
    })

    const isOwner = organization?.ownerId === session.user.id

    // Verify user is member of this organization (or owner)
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: idea.category.organizationId,
        userId: session.user.id,
      },
    })

    if (!membership && !isOwner) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    const reply = await prisma.ideaReply.create({
      data: {
        content,
        ideaId,
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(reply, { status: 201 })
  } catch (error) {
    console.error("Error creating idea reply:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
