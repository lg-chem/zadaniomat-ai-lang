import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { addDaysToDay, diffDays, isValidDay } from "@/lib/calendar"
import {
  eventInclude,
  fieldsFromEvent,
  mergeFields,
  normalizeFields,
  serializeEvent,
  shiftSeries,
  spanOf,
  toDbData,
  updateEventSchema,
} from "@/lib/calendar-events"
import { ownedCategoryId } from "@/lib/quarter-schemas"

async function findOwnedEvent(userId: string, id: string) {
  return prisma.calendarEvent.findFirst({ where: { id, userId } })
}

// PATCH - update an event. For a recurring event, `scope` decides what changes:
// "this" - only the occurrence on `occurrenceDate` (it becomes a separate event),
// "following" - this and later occurrences (the series is split),
// "all" - the whole series.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const event = await findOwnedEvent(userId, params.id)
    if (!event) {
      return NextResponse.json({ error: "Wydarzenie nie znalezione" }, { status: 404 })
    }

    const parsed = updateEventSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane wydarzenia" }, { status: 400 })
    }
    const { scope = "all", occurrenceDate, ...input } = parsed.data
    if (input.categoryId !== undefined) {
      input.categoryId = await ownedCategoryId(userId, input.categoryId ?? null)
    }

    const series = fieldsFromEvent(event)
    const isOccurrenceEdit = !!series.recurrenceRule && !!occurrenceDate

    // One-off event or the whole series
    if (!isOccurrenceEdit || scope === "all" || (scope === "following" && occurrenceDate! <= series.date)) {
      let base = series
      let changes = input
      if (isOccurrenceEdit) {
        // date/endDate in the request belong to the occurrence: move the series by the same amount
        const delta = input.date ? diffDays(input.date, occurrenceDate!) : 0
        base = shiftSeries(series, delta, input.recurrenceDays !== undefined)
        const { date: _date, endDate, ...rest } = input
        changes = rest
        if (endDate !== undefined && input.date) {
          changes = { ...rest, endDate: endDate ? addDaysToDay(base.date, diffDays(endDate, input.date)) : null }
        }
      }

      const normalized = normalizeFields(mergeFields(base, changes))
      if ("error" in normalized) {
        return NextResponse.json({ error: normalized.error }, { status: 400 })
      }
      const updated = await prisma.calendarEvent.update({
        where: { id: event.id },
        data: toDbData(normalized.fields),
        include: eventInclude,
      })
      return NextResponse.json(serializeEvent(updated))
    }

    const occurrence = occurrenceDate!
    const span = spanOf(series)
    const occurrenceBase = {
      ...series,
      date: occurrence,
      endDate: span ? addDaysToDay(occurrence, span) : null,
    }

    if (scope === "this") {
      // A separate one-off event replaces this occurrence
      const normalized = normalizeFields({
        ...mergeFields(occurrenceBase, input),
        recurrenceRule: null,
      })
      if ("error" in normalized) {
        return NextResponse.json({ error: normalized.error }, { status: 400 })
      }

      const created = await prisma.$transaction(async (tx) => {
        await tx.calendarEvent.update({
          where: { id: event.id },
          data: { excludedDates: Array.from(new Set([...series.excludedDates, occurrence])) },
        })
        return tx.calendarEvent.create({
          data: { ...toDbData(normalized.fields), workspaceType: event.workspaceType, userId },
          include: eventInclude,
        })
      })
      return NextResponse.json(serializeEvent(created))
    }

    // "following": the old series ends the day before, a new one starts here
    const delta = input.date ? diffDays(input.date, occurrence) : 0
    const newSeriesBase = shiftSeries(
      { ...occurrenceBase, excludedDates: series.excludedDates.filter((d) => d > occurrence) },
      delta,
      input.recurrenceDays !== undefined
    )
    const { date: _date, endDate, ...rest } = input
    const changes =
      endDate !== undefined && input.date
        ? { ...rest, endDate: endDate ? addDaysToDay(newSeriesBase.date, diffDays(endDate, input.date)) : null }
        : rest
    const normalized = normalizeFields(mergeFields(newSeriesBase, changes))
    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.calendarEvent.update({
        where: { id: event.id },
        data: {
          recurrenceEnd: new Date(`${addDaysToDay(occurrence, -1)}T00:00:00.000Z`),
          excludedDates: series.excludedDates.filter((d) => d < occurrence),
        },
      })
      return tx.calendarEvent.create({
        data: { ...toDbData(normalized.fields), workspaceType: event.workspaceType, userId },
        include: eventInclude,
      })
    })
    return NextResponse.json(serializeEvent(created))
  } catch (error) {
    console.error("Error updating calendar event:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE - ?scope=this|following|all&date=yyyy-MM-dd for recurring events
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const event = await findOwnedEvent(session.user.id, params.id)
    if (!event) {
      return NextResponse.json({ error: "Wydarzenie nie znalezione" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const scope = searchParams.get("scope") || "all"
    const date = searchParams.get("date")
    const series = fieldsFromEvent(event)

    if (series.recurrenceRule && scope !== "all" && !isValidDay(date)) {
      return NextResponse.json({ error: "Podaj datę wystąpienia" }, { status: 400 })
    }

    if (!series.recurrenceRule || scope === "all" || (scope === "following" && date! <= series.date)) {
      await prisma.calendarEvent.delete({ where: { id: event.id } })
      return NextResponse.json({ success: true })
    }

    const occurrence = date as string
    if (scope === "this") {
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { excludedDates: Array.from(new Set([...series.excludedDates, occurrence])) },
      })
    } else {
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          recurrenceEnd: new Date(`${addDaysToDay(occurrence, -1)}T00:00:00.000Z`),
          excludedDates: series.excludedDates.filter((d) => d < occurrence),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting calendar event:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
