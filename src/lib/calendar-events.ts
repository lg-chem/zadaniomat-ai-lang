import { z } from "zod"
import type { CalendarEvent, Prisma } from "@prisma/client"
import {
  RECURRENCE_RULES,
  addDaysToDay,
  diffDays,
  isValidDay,
  isValidTime,
  minutesToTime,
  timeToMinutes,
  toDayString,
  weekdayOf,
} from "@/lib/calendar"
import { normalizeRichText } from "@/lib/rich-text"

// Request validation and field rules for /api/calendar-events

const day = z.string().refine(isValidDay, "Nieprawidłowa data")
const time = z.string().refine(isValidTime, "Nieprawidłowa godzina")

export const eventFieldsSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(500_000).nullish(),
  date: day,
  endDate: day.nullish(),
  allDay: z.boolean(),
  startTime: time.nullish(),
  endTime: time.nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  recurrenceRule: z.enum(RECURRENCE_RULES).nullish(),
  recurrenceInterval: z.number().int().min(1).max(99),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).max(7),
  recurrenceEnd: day.nullish(),
  categoryId: z.string().nullish(),
})

export const createEventSchema = eventFieldsSchema.partial().required({ title: true, date: true })

export const updateEventSchema = eventFieldsSchema.partial().extend({
  // For recurring events: which occurrences the change applies to
  scope: z.enum(["this", "following", "all"]).optional(),
  // Day of the occurrence that was edited (date/endDate in the body refer to this occurrence)
  occurrenceDate: day.optional(),
})

export type EventFieldsInput = z.infer<typeof createEventSchema>

// Stored fields in "yyyy-MM-dd" form, the shape the rules below work on
export interface EventFields {
  title: string
  description: string | null
  date: string
  endDate: string | null
  allDay: boolean
  startTime: string | null
  endTime: string | null
  color: string | null
  recurrenceRule: string | null
  recurrenceInterval: number
  recurrenceDays: number[]
  recurrenceEnd: string | null
  excludedDates: string[]
  categoryId: string | null
}

export function fieldsFromEvent(event: CalendarEvent): EventFields {
  return {
    title: event.title,
    description: event.description,
    date: toDayString(event.date),
    endDate: event.endDate ? toDayString(event.endDate) : null,
    allDay: event.allDay,
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.color,
    recurrenceRule: event.recurrenceRule,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceDays: event.recurrenceDays,
    recurrenceEnd: event.recurrenceEnd ? toDayString(event.recurrenceEnd) : null,
    excludedDates: event.excludedDates,
    categoryId: event.categoryId,
  }
}

// Fields from the request on top of existing ones (undefined = keep)
export function mergeFields(base: EventFields, input: Partial<EventFieldsInput>): EventFields {
  const pick = <K extends keyof EventFieldsInput & keyof EventFields>(key: K): EventFields[K] =>
    (input[key] === undefined ? base[key] : input[key] ?? null) as EventFields[K]

  return {
    title: pick("title"),
    description: input.description === undefined ? base.description : normalizeRichText(input.description),
    date: pick("date"),
    endDate: pick("endDate"),
    allDay: input.allDay ?? base.allDay,
    startTime: pick("startTime"),
    endTime: pick("endTime"),
    color: pick("color"),
    recurrenceRule: pick("recurrenceRule"),
    recurrenceInterval: input.recurrenceInterval ?? base.recurrenceInterval,
    recurrenceDays: input.recurrenceDays ?? base.recurrenceDays,
    recurrenceEnd: pick("recurrenceEnd"),
    excludedDates: base.excludedDates,
    categoryId: pick("categoryId"),
  }
}

export const EMPTY_FIELDS: EventFields = {
  title: "",
  description: null,
  date: "",
  endDate: null,
  allDay: false,
  startTime: null,
  endTime: null,
  color: null,
  recurrenceRule: null,
  recurrenceInterval: 1,
  recurrenceDays: [],
  recurrenceEnd: null,
  excludedDates: [],
  categoryId: null,
}

// Makes the fields consistent; returns an error message when they can't be
export function normalizeFields(fields: EventFields): { fields: EventFields } | { error: string } {
  const f = { ...fields }

  if (f.allDay) {
    f.startTime = null
    f.endTime = null
    if (f.endDate && f.endDate <= f.date) f.endDate = null
  } else {
    f.endDate = null
    f.startTime = f.startTime || "09:00"
    const start = timeToMinutes(f.startTime)
    if (!f.endTime || timeToMinutes(f.endTime) <= start) {
      f.endTime = minutesToTime(Math.min(start + 60, 23 * 60 + 59))
    }
  }

  if (!f.recurrenceRule) {
    f.recurrenceInterval = 1
    f.recurrenceDays = []
    f.recurrenceEnd = null
    f.excludedDates = []
  } else {
    if (f.recurrenceRule === "WEEKLY") {
      if (f.recurrenceDays.length === 0) f.recurrenceDays = [weekdayOf(f.date)]
      f.recurrenceDays = Array.from(new Set(f.recurrenceDays)).sort((a, b) => a - b)
    } else {
      f.recurrenceDays = []
    }
    if (f.recurrenceRule === "WEEKDAYS") f.recurrenceInterval = 1
    if (f.recurrenceEnd && f.recurrenceEnd < f.date) {
      return { error: "Data zakończenia powtarzania jest przed pierwszym wystąpieniem" }
    }
    f.excludedDates = f.excludedDates.filter((d) => d >= f.date && (!f.recurrenceEnd || d <= f.recurrenceEnd))
  }

  return { fields: f }
}

// Moving an occurrence of a series by some days moves the whole series the same way
export function shiftSeries(fields: EventFields, delta: number, keepDays: boolean): EventFields {
  if (delta === 0) return fields
  const shiftWeekday = (d: number) => (((d + delta) % 7) + 7) % 7
  return {
    ...fields,
    date: addDaysToDay(fields.date, delta),
    endDate: fields.endDate ? addDaysToDay(fields.endDate, delta) : null,
    recurrenceDays: keepDays ? fields.recurrenceDays : fields.recurrenceDays.map(shiftWeekday),
    excludedDates: fields.excludedDates.map((d) => addDaysToDay(d, delta)),
  }
}

// Length in days of an all-day event (0 = one day)
export function spanOf(fields: Pick<EventFields, "date" | "endDate">): number {
  return fields.endDate ? Math.max(0, diffDays(fields.endDate, fields.date)) : 0
}

const dbDay = (value: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null)

export function toDbData(fields: EventFields) {
  return {
    title: fields.title,
    description: fields.description,
    date: new Date(`${fields.date}T00:00:00.000Z`),
    endDate: dbDay(fields.endDate),
    allDay: fields.allDay,
    startTime: fields.startTime,
    endTime: fields.endTime,
    color: fields.color,
    recurrenceRule: fields.recurrenceRule,
    recurrenceInterval: fields.recurrenceInterval,
    recurrenceDays: fields.recurrenceDays,
    recurrenceEnd: dbDay(fields.recurrenceEnd),
    excludedDates: fields.excludedDates,
    categoryId: fields.categoryId,
  } satisfies Omit<Prisma.CalendarEventUncheckedCreateInput, "userId" | "workspaceType">
}

export const eventInclude = {
  category: { select: { id: true, name: true, color: true } },
} as const

type EventWithCategory = CalendarEvent & { category: { id: string; name: string; color: string } | null }

// JSON shape for the client: days as "yyyy-MM-dd"
export function serializeEvent(event: EventWithCategory) {
  return {
    ...event,
    date: toDayString(event.date),
    endDate: event.endDate ? toDayString(event.endDate) : null,
    recurrenceEnd: event.recurrenceEnd ? toDayString(event.recurrenceEnd) : null,
  }
}
