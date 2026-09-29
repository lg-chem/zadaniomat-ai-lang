// Calendar helpers shared by the API and the UI: day arithmetic on "yyyy-MM-dd" strings,
// recurrence of events and recurring tasks, and layout of overlapping items.
// Days are counted in UTC so the result doesn't depend on the server or browser time zone.

export const RECURRENCE_RULES = ["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY", "YEARLY"] as const
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number]

export interface CalendarEventData {
  id: string
  title: string
  description?: string | null
  date: string // yyyy-MM-dd (ISO date-time from the API is accepted too)
  endDate?: string | null
  allDay: boolean
  startTime?: string | null
  endTime?: string | null
  color?: string | null
  recurrenceRule?: string | null
  recurrenceInterval: number
  recurrenceDays: number[]
  recurrenceEnd?: string | null
  excludedDates: string[]
  categoryId?: string | null
  category?: { id: string; name: string; color: string } | null
}

export interface EventOccurrence {
  key: string
  event: CalendarEventData
  date: string // first day of this occurrence
  endDate: string // last day (differs from date only for multi-day all-day events)
  color: string
}

export const DEFAULT_EVENT_COLOR = "#039be5"

export const EVENT_COLORS = [
  { name: "Pomidorowy", value: "#d50000" },
  { name: "Flaming", value: "#e67c73" },
  { name: "Mandarynkowy", value: "#f4511e" },
  { name: "Bananowy", value: "#f6bf26" },
  { name: "Szałwiowy", value: "#33b679" },
  { name: "Bazyliowy", value: "#0b8043" },
  { name: "Pawi", value: "#039be5" },
  { name: "Jagodowy", value: "#3f51b5" },
  { name: "Lawendowy", value: "#7986cb" },
  { name: "Winogronowy", value: "#8e24aa" },
  { name: "Grafitowy", value: "#616161" },
]

const DAY_MS = 86_400_000

// ---------- Days ----------

export function toDayString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value.slice(0, 10)
}

export function dayNumber(day: string): number {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function dayFromNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

export function addDaysToDay(day: string, amount: number): string {
  return dayFromNumber(dayNumber(day) + amount)
}

export function diffDays(later: string, earlier: string): number {
  return dayNumber(later) - dayNumber(earlier)
}

// 0 = Monday ... 6 = Sunday (same as WeeklyScheduleBlock.dayOfWeek)
export function weekdayOf(day: string | number): number {
  const n = typeof day === "number" ? day : dayNumber(day)
  return (new Date(n * DAY_MS).getUTCDay() + 6) % 7
}

export function isValidDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return dayFromNumber(dayNumber(value)) === value
}

// ---------- Times ----------

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// Start and end in minutes of a timed event; a missing or earlier end means one hour
export function eventMinutes(event: Pick<CalendarEventData, "startTime" | "endTime">): { start: number; end: number } {
  const start = event.startTime ? timeToMinutes(event.startTime) : 0
  let end = event.endTime ? timeToMinutes(event.endTime) : start + 60
  if (end <= start) end = Math.min(start + 60, 24 * 60)
  return { start, end }
}

// ---------- Event recurrence ----------

function dateParts(n: number) {
  const d = new Date(n * DAY_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() }
}

// Does an occurrence of the event start on this day?
export function eventOccursOn(event: CalendarEventData, day: number): boolean {
  const start = dayNumber(event.date)
  if (day < start) return false
  if (event.recurrenceEnd && day > dayNumber(event.recurrenceEnd)) return false

  const rule = event.recurrenceRule
  if (!rule) return day === start
  if (event.excludedDates?.includes(dayFromNumber(day))) return false

  const interval = Math.max(1, event.recurrenceInterval || 1)
  const diff = day - start

  switch (rule) {
    case "DAILY":
      return diff % interval === 0
    case "WEEKDAYS":
      return weekdayOf(day) < 5
    case "WEEKLY": {
      const days = event.recurrenceDays?.length ? event.recurrenceDays : [weekdayOf(start)]
      if (!days.includes(weekdayOf(day))) return false
      const startMonday = start - weekdayOf(start)
      const week = Math.floor((day - startMonday) / 7)
      return week % interval === 0
    }
    case "MONTHLY": {
      const s = dateParts(start)
      const d = dateParts(day)
      if (s.day !== d.day) return false
      const months = (d.year - s.year) * 12 + (d.month - s.month)
      return months % interval === 0
    }
    case "YEARLY": {
      const s = dateParts(start)
      const d = dateParts(day)
      if (s.day !== d.day || s.month !== d.month) return false
      return (d.year - s.year) % interval === 0
    }
    default:
      return day === start
  }
}

export function eventColor(event: Pick<CalendarEventData, "color" | "category">): string {
  return event.color || event.category?.color || DEFAULT_EVENT_COLOR
}

function eventSpan(event: CalendarEventData): number {
  if (!event.allDay || !event.endDate) return 0
  return Math.max(0, dayNumber(event.endDate) - dayNumber(event.date))
}

// All occurrences overlapping the range [from, to] (inclusive days)
export function expandEvents(events: CalendarEventData[], from: string, to: string): EventOccurrence[] {
  const fromN = dayNumber(from)
  const toN = dayNumber(to)
  const result: EventOccurrence[] = []

  for (const event of events) {
    const span = eventSpan(event)
    const start = dayNumber(event.date)
    const first = Math.max(fromN - span, start)
    const last = event.recurrenceRule ? toN : Math.min(toN, start)

    for (let n = first; n <= last; n++) {
      if (!eventOccursOn(event, n)) continue
      const date = dayFromNumber(n)
      result.push({
        key: `${event.id}:${date}`,
        event,
        date,
        endDate: dayFromNumber(n + span),
        color: eventColor(event),
      })
    }
  }

  return result.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1
    return (a.event.startTime || "").localeCompare(b.event.startTime || "")
  })
}

// Occurrences covering one day (multi-day events included)
export function occurrencesOnDay(occurrences: EventOccurrence[], day: string): EventOccurrence[] {
  return occurrences.filter((o) => o.date <= day && o.endDate >= day)
}

const WEEKDAY_SHORT = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"]
const MONTH_GENITIVE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
]

export function formatDayLong(day: string): string {
  const { year, month, day: d } = dateParts(dayNumber(day))
  return `${d} ${MONTH_GENITIVE[month]} ${year}`
}

export function describeRecurrence(
  event: Pick<CalendarEventData, "date" | "recurrenceRule" | "recurrenceInterval" | "recurrenceDays" | "recurrenceEnd">
): string | null {
  const rule = event.recurrenceRule
  if (!rule) return null
  const n = Math.max(1, event.recurrenceInterval || 1)
  const start = dateParts(dayNumber(event.date))
  let text: string

  switch (rule) {
    case "DAILY":
      text = n === 1 ? "Codziennie" : `Co ${n} dni`
      break
    case "WEEKDAYS":
      text = "W dni robocze (pon–pt)"
      break
    case "WEEKLY": {
      const days = (event.recurrenceDays?.length ? event.recurrenceDays : [weekdayOf(event.date)])
        .slice()
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_SHORT[d])
        .join(", ")
      text = `${n === 1 ? "Co tydzień" : `Co ${n} tyg.`} w: ${days}`
      break
    }
    case "MONTHLY":
      text = `${n === 1 ? "Co miesiąc" : `Co ${n} mies.`}, ${start.day}. dnia`
      break
    case "YEARLY":
      text = `${n === 1 ? "Co roku" : `Co ${n} lata`}, ${start.day} ${MONTH_GENITIVE[start.month]}`
      break
    default:
      return null
  }

  if (event.recurrenceEnd) text += `, do ${formatDayLong(toDayString(event.recurrenceEnd))}`
  return text
}

// ---------- Recurring tasks ----------

// Same rules as the task generator (/api/tasks/generate-recurring)
export function recurringTaskOccursOn(rule: string | null | undefined, startDay: string, day: string): boolean {
  if (!rule) return false
  const start = dayNumber(startDay)
  const target = dayNumber(day)
  if (target < start) return false

  switch (rule) {
    case "DAILY":
      return true
    case "WEEKLY":
      return (target - start) % 7 === 0
    case "WEEKDAYS":
      return weekdayOf(target) < 5
    case "MONTHLY":
      return dateParts(start).day === dateParts(target).day
    default:
      return false
  }
}

// ---------- Layout of overlapping items in a day column ----------

export interface TimedLayoutInput {
  key: string
  start: number // minutes
  end: number
}

export interface TimedLayout {
  key: string
  column: number
  columns: number
}

export function layoutTimedItems(items: TimedLayoutInput[]): Map<string, TimedLayout> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const result = new Map<string, TimedLayout>()
  let cluster: { key: string; column: number }[] = []
  let columnEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const item of cluster) result.set(item.key, { key: item.key, column: item.column, columns: columnEnds.length })
    cluster = []
    columnEnds = []
  }

  for (const item of sorted) {
    // Short items still take some room, so they are laid out as at least 20 minutes
    const end = Math.max(item.end, item.start + 20)
    if (item.start >= clusterEnd) flush()
    let column = columnEnds.findIndex((colEnd) => colEnd <= item.start)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(end)
    } else {
      columnEnds[column] = end
    }
    cluster.push({ key: item.key, column })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()

  return result
}
