import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Per-user data - never prerendered at build time
export const dynamic = "force-dynamic"

const MAX_IDS = 100

// GET ?ids=a,b,c - status of tasks linked in a note or description (crossed out when done).
// Tasks that are gone or not ours are left out.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const ids = Array.from(
      new Set(
        (searchParams.get("ids") ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      )
    ).slice(0, MAX_IDS)
    if (ids.length === 0) return NextResponse.json([])

    const tasks = await prisma.task.findMany({
      where: {
        id: { in: ids },
        OR: [{ userId }, { assignedToId: userId }],
      },
      select: { id: true, title: true, status: true, scheduledDate: true, scheduledTime: true },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching linked tasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
