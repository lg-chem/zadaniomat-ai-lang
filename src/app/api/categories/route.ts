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
    const workspace = searchParams.get("workspace")

    const where: Record<string, unknown> = {
      userId: session.user.id,
    }

    if (workspace) {
      where.workspaceType = workspace
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { order: "asc" },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
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
    const { name, color, icon, isStrategic, workspaceType = "WORK" } = body

    if (!name) {
      return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 })
    }

    // Get max order
    const maxOrder = await prisma.category.findFirst({
      where: { userId: session.user.id, workspaceType },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const category = await prisma.category.create({
      data: {
        name,
        color: color || "#6366f1",
        icon,
        isStrategic: isStrategic || false,
        workspaceType,
        order: (maxOrder?.order || 0) + 1,
        userId: session.user.id,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Error creating category:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
