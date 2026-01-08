import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

interface UnreadRequest {
  lastReadTimestamps?: Record<string, string> // organizationId -> ISO timestamp
}

// POST - Get unread message counts for user's organizations
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: UnreadRequest = await req.json().catch(() => ({}))
    const lastReadTimestamps = body.lastReadTimestamps || {}

    // Get all organizations user is member of
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: {
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Count unread messages for each organization
    const unreadCounts: Record<string, number> = {}
    let totalUnread = 0

    for (const membership of memberships) {
      const orgId = membership.organizationId
      const lastRead = lastReadTimestamps[orgId]
        ? new Date(lastReadTimestamps[orgId])
        : new Date(0) // Count all if never read

      const count = await prisma.teamMessage.count({
        where: {
          organizationId: orgId,
          createdAt: { gt: lastRead },
          userId: { not: session.user.id }, // Don't count own messages
        },
      })

      unreadCounts[orgId] = count
      totalUnread += count
    }

    return NextResponse.json({
      totalUnread,
      unreadCounts,
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        unreadCount: unreadCounts[m.organizationId] || 0,
      })),
    })
  } catch (error) {
    console.error("Error fetching unread counts:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
