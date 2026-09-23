import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { ensureQuarter, hasAnyQuarter, loadQuarter, loadSprintHistory } from "@/lib/quarter-data"
import type { QuarterResponse } from "@/lib/quarters"

const quarterRefSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  quarter: z.coerce.number().int().min(1).max(4),
})

// Get a calendar quarter (goals, key results, sprints) - quarter is null when not planned yet
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const parsed = quarterRefSchema.safeParse({
      year: searchParams.get("year"),
      quarter: searchParams.get("quarter"),
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowy kwartał" }, { status: 400 })
    }

    const [quarter, history, hasQuarters] = await Promise.all([
      loadQuarter(session.user.id, parsed.data),
      loadSprintHistory(session.user.id),
      hasAnyQuarter(session.user.id),
    ])

    const response: QuarterResponse = { quarter, history, hasQuarters }
    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching quarter:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Create a calendar quarter with its 6 two-week sprints (idempotent)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = quarterRefSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowy kwartał" }, { status: 400 })
    }

    await ensureQuarter(session.user.id, parsed.data)
    const quarter = await loadQuarter(session.user.id, parsed.data)

    return NextResponse.json(quarter, { status: 201 })
  } catch (error) {
    console.error("Error creating quarter:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
