import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeSelf = searchParams.get("includeSelf") === "true"

    // Get all approved users (optionally excluding current user)
    const users = await prisma.user.findMany({
      where: {
        isApproved: true,
        ...(includeSelf ? {} : { id: { not: session.user.id } }),
      },
      select: {
        id: true,
        name: true,
        image: true,
        // Count public items (for self, count all items)
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

    // Mark the current user
    const result = usersWithPublicContent.map((user) => ({
      ...user,
      isSelf: user.id === session.user.id,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching friends:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
