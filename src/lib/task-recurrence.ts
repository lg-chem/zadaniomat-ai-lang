// Recurring tasks: which days a recurring task lands on.
// Rules are stored in Task.recurrenceRule. Old rules are plain tokens anchored to the task's date
// ("DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY", "SPRINT_END_7", "PERIOD_END_14");
// new ones use a subset of RRULE, e.g. "FREQ=MONTHLY;BYMONTHDAY=10;DTSTART=20261010;X-WEEKEND=BEFORE".
// Shared by the task generator (server), the recurring tasks page and the calendar.

import { addDaysToDay, dayFromNumber, dayNumber, isValidDay, weekdayOf } from "@/lib/calendar"

export type TaskFrequency = "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY" | "YEARLY" | "SPRINT_END" | "PERIOD_END"

// Monthly: a day of the month (-1 = last day) or the n-th weekday / working day (-1 = last)
export type MonthlyMode =
  | { type: "day"; day: number }
  | { type: "weekday"; nth: number; weekday: number }
  | { type: "workday"; nth: number }

export type WeekendShift = "BEFORE" | "AFTER"

export interface TaskRecurrence {
  freq: TaskFrequency
  interval: number
  weekdays: number[] // WEEKLY, 0 = Monday
  monthly: MonthlyMode // MONTHLY
  daysBefore: number // SPRINT_END / PERIOD_END
  weekend: WeekendShift | null // MONTHLY / YEARLY: move a date that falls on a weekend
  anchor: string | null // first occurrence, counts intervals and the day of a yearly task
  until: string | null
}

// End dates of sprints and periods, needed only by SPRINT_END / PERIOD_END rules
export interface RecurrenceContext {
  sprintEnds?: string[]
  periodEnds?: string[]
}

const RRULE_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
const DAY_MS = 86_400_000

export const DEFAULT_RECURRENCE: TaskRecurrence = {
  freq: "DAILY",
  interval: 1,
  weekdays: [],
  monthly: { type: "day", day: 1 },
  daysBefore: 7,
  weekend: null,
  anchor: null,
  until: null,
}

// ---------- parsing ----------

const toCompact = (day: string) => day.replace(/-/g, "")
const fromCompact = (value: string) =>
  /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null

function parts(n: number) {
  const d = new Date(n * DAY_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate() }
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

// Legacy rules take their day from the task's date (`fallbackAnchor`)
export function parseTaskRecurrence(rule: string | null | undefined, fallbackAnchor?: string | null): TaskRecurrence | null {
  if (!rule) return null
  const anchor = fallbackAnchor && isValidDay(fallbackAnchor) ? fallbackAnchor : null
  const base: TaskRecurrence = { ...DEFAULT_RECURRENCE, anchor }

  switch (rule) {
    case "DAILY":
      return { ...base, freq: "DAILY" }
    case "WEEKDAYS":
      return { ...base, freq: "WEEKDAYS" }
    case "WEEKLY":
      return { ...base, freq: "WEEKLY", weekdays: anchor ? [weekdayOf(anchor)] : [] }
    case "MONTHLY":
      return { ...base, freq: "MONTHLY", monthly: { type: "day", day: anchor ? parts(dayNumber(anchor)).date : 1 } }
  }

  const deadline = /^(SPRINT|PERIOD)_END_(\d{1,3})$/.exec(rule)
  if (deadline) {
    return { ...base, freq: deadline[1] === "SPRINT" ? "SPRINT_END" : "PERIOD_END", daysBefore: Number(deadline[2]) }
  }

  if (!rule.startsWith("FREQ=")) return null
  const params = new Map(
    rule.split(";").map((pair) => {
      const [key, ...rest] = pair.split("=")
      return [key.toUpperCase(), rest.join("=").toUpperCase()] as const
    })
  )

  const freq = params.get("FREQ")
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null

  const result: TaskRecurrence = {
    ...base,
    freq,
    interval: Math.max(1, Math.min(99, parseInt(params.get("INTERVAL") || "1") || 1)),
    anchor: fromCompact(params.get("DTSTART") || "") ?? anchor,
    until: fromCompact(params.get("UNTIL") || ""),
    weekend: params.get("X-WEEKEND") === "BEFORE" ? "BEFORE" : params.get("X-WEEKEND") === "AFTER" ? "AFTER" : null,
  }

  const byDay = (params.get("BYDAY") || "").split(",").filter(Boolean)

  if (freq === "WEEKLY") {
    result.weekdays = byDay.map((d) => RRULE_DAYS.indexOf(d)).filter((d) => d >= 0)
    if (result.weekdays.length === 5 && result.weekdays.every((d) => d < 5) && result.interval === 1) {
      result.freq = "WEEKDAYS"
    }
  }

  if (freq === "MONTHLY") {
    const monthDay = parseInt(params.get("BYMONTHDAY") || "")
    const setPos = parseInt(params.get("BYSETPOS") || "")
    const nthWeekday = byDay.length === 1 ? /^(-?\d)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(byDay[0]) : null
    if (!Number.isNaN(monthDay)) {
      result.monthly = { type: "day", day: monthDay === -1 ? -1 : Math.max(1, Math.min(31, monthDay)) }
    } else if (byDay.length === 5 && !Number.isNaN(setPos)) {
      result.monthly = { type: "workday", nth: setPos }
    } else if (nthWeekday) {
      result.monthly = { type: "weekday", nth: parseInt(nthWeekday[1] || "1"), weekday: RRULE_DAYS.indexOf(nthWeekday[2]) }
    } else {
      result.monthly = { type: "day", day: result.anchor ? parts(dayNumber(result.anchor)).date : 1 }
    }
  }

  return result
}

export function serializeTaskRecurrence(r: TaskRecurrence): string {
  if (r.freq === "SPRINT_END") return `SPRINT_END_${Math.max(0, Math.round(r.daysBefore))}`
  if (r.freq === "PERIOD_END") return `PERIOD_END_${Math.max(0, Math.round(r.daysBefore))}`

  const out: string[] = []
  if (r.freq === "WEEKDAYS") {
    out.push("FREQ=WEEKLY", "BYDAY=MO,TU,WE,TH,FR")
  } else {
    out.push(`FREQ=${r.freq}`)
    if (r.interval > 1) out.push(`INTERVAL=${r.interval}`)
    if (r.freq === "WEEKLY") {
      const days = Array.from(new Set(r.weekdays)).sort((a, b) => a - b)
      out.push(`BYDAY=${days.map((d) => RRULE_DAYS[d]).join(",")}`)
    }
    if (r.freq === "MONTHLY") {
      const m = r.monthly
      if (m.type === "day") out.push(`BYMONTHDAY=${m.day}`)
      else if (m.type === "weekday") out.push(`BYDAY=${m.nth}${RRULE_DAYS[m.weekday]}`)
      else out.push("BYDAY=MO,TU,WE,TH,FR", `BYSETPOS=${m.nth}`)
    }
  }
  if (r.anchor) out.push(`DTSTART=${toCompact(r.anchor)}`)
  if (r.until) out.push(`UNTIL=${toCompact(r.until)}`)
  if (r.weekend && (r.freq === "MONTHLY" || r.freq === "YEARLY")) out.push(`X-WEEKEND=${r.weekend}`)
  return out.join(";")
}

// ---------- occurrences ----------

function workdaysOfMonth(year: number, month: number): number[] {
  const first = Math.round(Date.UTC(year, month, 1) / DAY_MS)
  const count = daysInMonth(year, month)
  const result: number[] = []
  for (let n = first; n < first + count; n++) if (weekdayOf(n) < 5) result.push(n)
  return result
}

// The day pattern alone (which days of the week / month), without interval and start
function matchesPattern(r: TaskRecurrence, n: number): boolean {
  switch (r.freq) {
    case "DAILY":
      return true
    case "WEEKDAYS":
      return weekdayOf(n) < 5
    case "WEEKLY":
      return (r.weekdays.length ? r.weekdays : r.anchor ? [weekdayOf(r.anchor)] : []).includes(weekdayOf(n))
    case "MONTHLY": {
      const { year, month, date } = parts(n)
      const last = daysInMonth(year, month)
      const m = r.monthly
      if (m.type === "day") return date === (m.day === -1 ? last : Math.min(m.day, last))
      if (m.type === "weekday") {
        if (weekdayOf(n) !== m.weekday) return false
        return m.nth === -1 ? date + 7 > last : Math.floor((date - 1) / 7) + 1 === m.nth
      }
      const workdays = workdaysOfMonth(year, month)
      const index = m.nth === -1 ? workdays.length - 1 : m.nth - 1
      return workdays[index] === n
    }
    case "YEARLY": {
      if (!r.anchor) return false
      const a = parts(dayNumber(r.anchor))
      const { year, month, date } = parts(n)
      return month === a.month && date === Math.min(a.date, daysInMonth(year, month))
    }
    default:
      return false
  }
}

function matchesInterval(r: TaskRecurrence, n: number): boolean {
  if (r.interval <= 1 || !r.anchor) return true
  const a = dayNumber(r.anchor)
  switch (r.freq) {
    case "DAILY":
      return (n - a) % r.interval === 0
    case "WEEKLY": {
      // Whole weeks between the Mondays of both days
      const weeks = (n - weekdayOf(n) - (a - weekdayOf(a))) / 7
      return weeks % r.interval === 0
    }
    case "MONTHLY": {
      const p = parts(n)
      const q = parts(a)
      return ((p.year - q.year) * 12 + (p.month - q.month)) % r.interval === 0
    }
    case "YEARLY":
      return (parts(n).year - parts(a).year) % r.interval === 0
    default:
      return true
  }
}

// Before shifting a weekend date to Friday / Monday
function rawOccurs(r: TaskRecurrence, n: number): boolean {
  if (r.anchor && n < dayNumber(r.anchor)) return false
  if (r.until && n > dayNumber(r.until)) return false
  return matchesPattern(r, n) && matchesInterval(r, n)
}

function shiftWeekend(r: TaskRecurrence, n: number): number {
  if (!r.weekend || (r.freq !== "MONTHLY" && r.freq !== "YEARLY")) return n
  const weekday = weekdayOf(n)
  if (weekday < 5) return n
  if (r.weekend === "BEFORE") return n - (weekday - 4) // Sat -1, Sun -2
  return n + (7 - weekday) // Sat +2, Sun +1
}

export function recurrenceOccursOn(r: TaskRecurrence, day: string, context?: RecurrenceContext): boolean {
  const n = dayNumber(day)

  if (r.freq === "SPRINT_END" || r.freq === "PERIOD_END") {
    if (r.anchor && n < dayNumber(r.anchor)) return false
    if (r.until && n > dayNumber(r.until)) return false
    const ends = (r.freq === "SPRINT_END" ? context?.sprintEnds : context?.periodEnds) ?? []
    return ends.includes(addDaysToDay(day, r.daysBefore))
  }

  if (!r.weekend) return rawOccurs(r, n)
  for (let offset = -2; offset <= 2; offset++) {
    const candidate = n + offset
    if (rawOccurs(r, candidate) && shiftWeekend(r, candidate) === n) return true
  }
  return false
}

// For a task stored with `rule` whose own date is `taskDay`
export function taskOccursOn(
  rule: string | null | undefined,
  taskDay: string,
  day: string,
  context?: RecurrenceContext
): boolean {
  if (day < taskDay) return false
  const r = parseTaskRecurrence(rule, taskDay)
  return !!r && recurrenceOccursOn(r, day, context)
}

export function nextOccurrences(
  r: TaskRecurrence,
  from: string,
  count: number,
  context?: RecurrenceContext,
  maxDays = 3 * 366
): string[] {
  const result: string[] = []
  const start = dayNumber(from)
  for (let n = start; n < start + maxDays && result.length < count; n++) {
    const day = dayFromNumber(n)
    if (recurrenceOccursOn(r, day, context)) result.push(day)
  }
  return result
}

// Sets the anchor for a new or edited rule: the first day on or after `start` that fits the
// pattern (intervals count from there), and returns the day the task itself should be put on
export function anchorRecurrence(
  r: TaskRecurrence,
  start: string,
  context?: RecurrenceContext,
  notBefore?: string
): { recurrence: TaskRecurrence; firstDay: string } {
  const withoutAnchor: TaskRecurrence = { ...r, anchor: null }
  let anchor = start

  if (r.freq !== "YEARLY" && r.freq !== "SPRINT_END" && r.freq !== "PERIOD_END") {
    const pattern: TaskRecurrence = { ...withoutAnchor, interval: 1, until: null, weekend: null }
    const n0 = dayNumber(start)
    for (let n = n0; n < n0 + 400; n++) {
      if (matchesPattern(pattern, n)) {
        anchor = dayFromNumber(n)
        break
      }
    }
  }

  const recurrence: TaskRecurrence = { ...r, anchor }
  const firstDay = firstOccurrenceFrom(recurrence, start, context, notBefore) ?? (notBefore && notBefore > start ? notBefore : start)
  return { recurrence, firstDay }
}

// First day on or after `start` (and not before `notBefore`); a weekend date moved to
// Friday can land up to 2 days before `start`
export function firstOccurrenceFrom(
  r: TaskRecurrence,
  start: string,
  context?: RecurrenceContext,
  notBefore?: string,
  count = 1
): string | undefined {
  const from = notBefore && notBefore > start ? notBefore : start
  let searchFrom = from
  if (r.weekend === "BEFORE") {
    const earlier = addDaysToDay(from, -2)
    searchFrom = notBefore && notBefore > earlier ? notBefore : earlier
  }
  return nextOccurrences(r, searchFrom, count, context, 400 * r.interval)[0]
}

// ---------- labels ----------

const WEEKDAY_NAMES = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"]
const WEEKDAY_SHORT = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"]
// "w poniedziałek", "we wtorek", "w środę"...
const WEEKDAY_ACCUSATIVE = ["w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę", "w niedzielę"]
const NTH_MASCULINE: Record<number, string> = { 1: "pierwszy", 2: "drugi", 3: "trzeci", 4: "czwarty", [-1]: "ostatni" }
const NTH_FEMININE: Record<number, string> = { 1: "pierwszą", 2: "drugą", 3: "trzecią", 4: "czwartą", [-1]: "ostatnią" }
const MONTHS_GENITIVE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
]

export { WEEKDAY_NAMES, NTH_MASCULINE }

function nthWeekdayLabel(nth: number, weekday: number) {
  // środa, sobota, niedziela are feminine
  const feminine = weekday === 2 || weekday === 5 || weekday === 6
  const nthLabel = (feminine ? NTH_FEMININE : NTH_MASCULINE)[nth] ?? `${nth}.`
  return `w ${nthLabel} ${WEEKDAY_ACCUSATIVE[weekday].replace(/^we? /, "")}`
}

export function formatDayShort(day: string): string {
  const { month, date } = parts(dayNumber(day))
  return `${WEEKDAY_SHORT[weekdayOf(day)]} ${date} ${MONTHS_GENITIVE[month].slice(0, 3)}`
}

export function describeTaskRecurrence(r: TaskRecurrence): string {
  const every = (one: string, many: (n: number) => string) => (r.interval > 1 ? many(r.interval) : one)
  let text: string

  switch (r.freq) {
    case "DAILY":
      text = every("Codziennie", (n) => `Co ${n} dni`)
      break
    case "WEEKDAYS":
      text = "W dni robocze (pon–pt)"
      break
    case "WEEKLY": {
      const days = (r.weekdays.length ? r.weekdays : r.anchor ? [weekdayOf(r.anchor)] : [])
        .slice()
        .sort((a, b) => a - b)
      const list = days.length === 1 ? WEEKDAY_ACCUSATIVE[days[0]] : `w: ${days.map((d) => WEEKDAY_SHORT[d]).join(", ")}`
      text = `${every("Co tydzień", (n) => `Co ${n} tyg.`)} ${list}`
      break
    }
    case "MONTHLY": {
      const m = r.monthly
      const when =
        m.type === "day"
          ? m.day === -1
            ? "ostatniego dnia miesiąca"
            : `${m.day}. dnia`
          : m.type === "weekday"
            ? nthWeekdayLabel(m.nth, m.weekday)
            : `${m.nth === -1 ? "ostatni" : NTH_MASCULINE[m.nth] ?? `${m.nth}.`} dzień roboczy`
      text = `${every("Co miesiąc", (n) => `Co ${n} mies.`)}, ${when}`
      break
    }
    case "YEARLY": {
      const a = r.anchor ? parts(dayNumber(r.anchor)) : null
      text = `${every("Co roku", (n) => `Co ${n} lata`)}${a ? `, ${a.date} ${MONTHS_GENITIVE[a.month]}` : ""}`
      break
    }
    case "SPRINT_END":
      text = r.daysBefore === 0 ? "W ostatni dzień sprintu" : `${r.daysBefore} ${r.daysBefore === 1 ? "dzień" : "dni"} przed końcem sprintu`
      break
    case "PERIOD_END":
      text = r.daysBefore === 0 ? "W ostatni dzień okresu" : `${r.daysBefore} ${r.daysBefore === 1 ? "dzień" : "dni"} przed końcem okresu`
      break
  }

  if (r.weekend === "BEFORE") text += " (weekend → piątek przed)"
  if (r.weekend === "AFTER") text += " (weekend → poniedziałek po)"
  if (r.until) {
    const u = parts(dayNumber(r.until))
    text += `, do ${u.date} ${MONTHS_GENITIVE[u.month]} ${u.year}`
  }
  return text
}

export function describeTaskRule(rule: string | null | undefined, taskDay?: string | null): string {
  const r = parseTaskRecurrence(rule, taskDay)
  return r ? describeTaskRecurrence(r) : rule || ""
}

// Grouping on the recurring tasks page
export const FREQUENCY_GROUPS: { freq: TaskFrequency[]; label: string }[] = [
  { freq: ["DAILY", "WEEKDAYS"], label: "Codziennie i co kilka dni" },
  { freq: ["WEEKLY"], label: "Co tydzień" },
  { freq: ["MONTHLY"], label: "Co miesiąc" },
  { freq: ["YEARLY"], label: "Co rok" },
  { freq: ["SPRINT_END", "PERIOD_END"], label: "Przed końcem sprintu / okresu" },
]

// Short options for quick add (the task's own date decides the day)
export function quickRecurrenceOptions(day: string): { value: string; label: string }[] {
  const { date } = parts(dayNumber(day))
  return [
    { value: "DAILY", label: "Codziennie" },
    { value: "WEEKDAYS", label: "W dni robocze (pon–pt)" },
    { value: "WEEKLY", label: `Co tydzień ${WEEKDAY_ACCUSATIVE[weekdayOf(day)]}` },
    { value: "MONTHLY", label: `Co miesiąc, ${date}. dnia` },
  ]
}
