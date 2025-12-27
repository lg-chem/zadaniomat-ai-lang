import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

const DEFAULT_TYPES = [
  { name: "Siłownia", color: "#ef4444", hasBodyParts: true },
  { name: "Padel", color: "#f59e0b", hasBodyParts: false },
  { name: "Basen", color: "#3b82f6", hasBodyParts: false },
  { name: "Rower", color: "#10b981", hasBodyParts: false },
  { name: "Spacer", color: "#8b5cf6", hasBodyParts: false },
]

// Get activity types (defaults + user custom)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure default types exist for this user
    const existingDefaults = await prisma.sportActivityType.findMany({
      where: {
        userId: session.user.id,
        name: { in: DEFAULT_TYPES.map((t) => t.name) },
      },
    })

    const existingNames = new Set(existingDefaults.map((t) => t.name))
    const missingDefaults = DEFAULT_TYPES.filter((t) => !existingNames.has(t.name))

    if (missingDefaults.length > 0) {
      await prisma.sportActivityType.createMany({
        data: missingDefaults.map((t) => ({
          name: t.name,
          color: t.color,
          hasBodyParts: t.hasBodyParts,
          isDefault: false,
          userId: session.user.id,
        })),
      })
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
