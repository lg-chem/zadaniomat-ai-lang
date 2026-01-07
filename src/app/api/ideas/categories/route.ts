import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get("organizationId")

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 })
    }

    // Verify user is member of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    const categories = await prisma.ideaCategory.findMany({
      where: {
        organizationId,
      },
      include: {
        _count: {
          select: { ideas: true },
        },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching idea categories:", error)
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
    const { name, color, emoji, organizationId } = body

    if (!name || !organizationId) {
      return NextResponse.json(
        { error: "Nazwa i zespół są wymagane" },
        { status: 400 }
      )
    }

    // Verify user is owner of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: "OWNER",
      },
    })

    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        ownerId: session.user.id,
      },
    })

    if (!membership && !organization) {
      return NextResponse.json(
        { error: "Tylko admin może tworzyć kategorie" },
        { status: 403 }
      )
    }

    const category = await prisma.ideaCategory.create({
      data: {
        name,
        color: color || "#8b5cf6",
        emoji,
        organizationId,
      },
      include: {
        _count: {
          select: { ideas: true },
        },
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Error creating idea category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
