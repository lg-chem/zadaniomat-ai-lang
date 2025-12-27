import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Get activity types (defaults + user custom)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const types = await prisma.sportActivityType.findMany({
      where: {
        OR: [
          { isDefault: true },
          { userId: session.user.id },
        ],
      },
      orderBy: [
        { isDefault: "desc" },
        { name: "asc" },
      ],
    })

    return NextResponse.json(types)
  } catch (error) {
    console.error("Error fetching sport types:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Create custom activity type
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, icon, color, hasBodyParts } = body

    if (!name) {
      return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 })
    }

    const type = await prisma.sportActivityType.create({
      data: {
        name,
        icon,
        color: color || "#3b82f6",
        hasBodyParts: hasBodyParts || false,
        isDefault: false,
        userId: session.user.id,
      },
    })

    return NextResponse.json(type, { status: 201 })
  } catch (error) {
    console.error("Error creating sport type:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
