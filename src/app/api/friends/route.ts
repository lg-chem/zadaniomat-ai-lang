import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all approved users except the current user
    const users = await prisma.user.findMany({
      where: {
        isApproved: true,
        id: { not: session.user.id },
      },
      select: {
        id: true,
        name: true,
        image: true,
        // Count public items
        _count: {
          select: {
            habits: { where: { isPublic: true, isActive: true } },
            challenges: { where: { isPublic: true } },
            sportActivities: { where: { isPublic: true } },
            stepsEntries: { where: { isPublic: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    })

    // Filter users who have at least one public item
    const usersWithPublicContent = users.filter(
      (user) =>
        user._count.habits > 0 ||
        user._count.challenges > 0 ||
        user._count.sportActivities > 0 ||
        user._count.stepsEntries > 0
    )

    return NextResponse.json(usersWithPublicContent)
  } catch (error) {
    console.error("Error fetching friends:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
