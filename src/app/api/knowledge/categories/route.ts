import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Default knowledge categories
const DEFAULT_CATEGORIES = [
  { name: "Ogólne", description: "Ogólne informacje", color: "#6366f1", icon: "info" },
  { name: "O mnie", description: "Informacje osobiste", color: "#10b981", icon: "user" },
  { name: "Preferencje", description: "Preferencje i ustawienia", color: "#f59e0b", icon: "settings" },
]

const DEFAULT_WORK_CATEGORIES = [
  { name: "Firma", description: "Informacje o firmie", color: "#3b82f6", icon: "building" },
  { name: "Produkty", description: "Informacje o produktach", color: "#ef4444", icon: "package" },
  { name: "Klienci", description: "Informacje o klientach", color: "#8b5cf6", icon: "users" },
  { name: "Procesy", description: "Procesy biznesowe", color: "#06b6d4", icon: "workflow" },
]

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") || "WORK"

    // Get categories with entry count
    const categories = await prisma.knowledgeCategory.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
      },
      include: {
        linkedCategory: true,
        _count: {
          select: { entries: true },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })

    // If no categories exist, create defaults
    if (categories.length === 0) {
      const defaults = workspace === "WORK"
        ? [...DEFAULT_CATEGORIES, ...DEFAULT_WORK_CATEGORIES]
        : DEFAULT_CATEGORIES

      const createdCategories = await Promise.all(
        defaults.map((cat, idx) =>
          prisma.knowledgeCategory.create({
            data: {
              ...cat,
              workspaceType: workspace as "WORK" | "PRIVATE",
              userId: session.user.id,
              isDefault: true,
              order: idx,
            },
            include: {
              linkedCategory: true,
              _count: {
                select: { entries: true },
              },
            },
          })
        )
      )

      return NextResponse.json(createdCategories)
    }

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching knowledge categories:", error)
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
    const { name, description, color, icon, workspace, linkedCategoryId } = body

    if (!name) {
      return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 })
    }

    // Get max order
    const maxOrder = await prisma.knowledgeCategory.findFirst({
      where: {
        userId: session.user.id,
        workspaceType: workspace || "WORK",
      },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const category = await prisma.knowledgeCategory.create({
      data: {
        name,
        description,
        color: color || "#6366f1",
        icon,
        workspaceType: workspace || "WORK",
        userId: session.user.id,
        linkedCategoryId,
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: {
        linkedCategory: true,
        _count: {
          select: { entries: true },
        },
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Error creating knowledge category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
