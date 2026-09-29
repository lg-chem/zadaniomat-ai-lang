import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { addDaysToDay, isValidDay } from "@/lib/calendar"
import {
  EMPTY_FIELDS,
  createEventSchema,
  eventInclude,
  mergeFields,
  normalizeFields,
  serializeEvent,
  toDbData,
} from "@/lib/calendar-events"
import { ownedCategoryId } from "@/lib/quarter-schemas"

const toWorkspace = (value: unknown) => (value === "PRIVATE" ? "PRIVATE" : "WORK")
const dbDay = (day: string) => new Date(`${day}T00:00:00.000Z`)

// Longest all-day event that can still reach into the range from before it
const MAX_SPAN_DAYS = 366

// GET - events that can have occurrences in [from, to]; the client expands recurring ones
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceType = toWorkspace(searchParams.get("workspace"))
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!isValidDay(from) || !isValidDay(to) || from > to) {
      return NextResponse.json({ error: "Podaj zakres dat (from, to)" }, { status: 400 })
    }

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: session.user.id,
        workspaceType,
        date: { lte: dbDay(to) },
        OR: [
          // One-off events starting in the range or spanning into it
          { recurrenceRule: null, date: { gte: dbDay(from) } },
          { recurrenceRule: null, endDate: { gte: dbDay(from) } },
          // Recurring events that haven't ended before the range
          { recurrenceRule: { not: null }, recurrenceEnd: null },
          { recurrenceRule: { not: null }, recurrenceEnd: { gte: dbDay(addDaysToDay(from, -MAX_SPAN_DAYS)) } },
        ],
      },
      include: eventInclude,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    })

    return NextResponse.json(events.map(serializeEvent))
  } catch (error) {
    console.error("Error fetching calendar events:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - create an event
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const parsed = createEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane wydarzenia" }, { status: 400 })
    }

    const normalized = normalizeFields(mergeFields(EMPTY_FIELDS, parsed.data))
    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }
    const fields = normalized.fields
    fields.categoryId = await ownedCategoryId(userId, fields.categoryId)

    const event = await prisma.calendarEvent.create({
      data: {
        ...toDbData(fields),
        workspaceType: toWorkspace(body.workspaceType),
        userId,
      },
      include: eventInclude,
    })

    return NextResponse.json(serializeEvent(event), { status: 201 })
  } catch (error) {
    console.error("Error creating calendar event:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
