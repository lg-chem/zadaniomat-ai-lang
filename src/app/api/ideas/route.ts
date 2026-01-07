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
    const categoryId = searchParams.get("categoryId")

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

    const ideas = await prisma.idea.findMany({
      where: {
        category: {
          organizationId,
        },
        ...(categoryId && { categoryId }),
      },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(ideas)
  } catch (error) {
    console.error("Error fetching ideas:", error)
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
    const { content, categoryId } = body

    if (!content || !categoryId) {
      return NextResponse.json(
        { error: "Treść i kategoria są wymagane" },
        { status: 400 }
      )
    }

    // Verify category exists and user has access
    const category = await prisma.ideaCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    // Verify user is member of the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: category.organizationId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Nie masz dostępu do tego zespołu" },
        { status: 403 }
      )
    }

    const idea = await prisma.idea.create({
      data: {
        content,
        categoryId,
        userId: session.user.id,
      },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(idea, { status: 201 })
  } catch (error) {
    console.error("Error creating idea:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
