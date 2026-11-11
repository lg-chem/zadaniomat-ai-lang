// Shared rules of the private trackers (habits, sport, challenges): days, streaks,
// challenge progress and pace. Pure functions - used by the API and by the pages
// (the pages recount on a click, before the server answers).

export type HabitFrequency = "DAILY" | "WEEKLY" | "MONTHLY"
export type ChallengeType = "NUMERIC" | "WEEKLY_HABIT" | "MONTHLY_GOAL" | "DAILY_GOAL"
export type LinkedType = "NONE" | "HABIT" | "SPORT" | "STEPS"
export type LinkedMetric = "COUNT" | "MINUTES" | "VALUE"

// ---------- days (yyyy-MM-dd keys) ----------

/** Day of a stored date. Days are saved as UTC midnight, so the day is the first 10 characters */
export function dayKeyOf(value: string | Date): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10)
}

/** Today on this device (the user's day, not the server's) */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function utc(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

/** Stored date of a day */
export function dateOfKey(key: string): Date {
  return utc(key)
}

export function addDaysKey(key: string, days: number): string {
  const d = utc(key)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Days from a to b (b later - positive) */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000)
}

/** Monday of the week */
export function weekStartKey(key: string): string {
  const weekday = (utc(key).getUTCDay() + 6) % 7
  return addDaysKey(key, -weekday)
}

export function weekKeys(anyDayOfWeek: string): string[] {
  const start = weekStartKey(anyDayOfWeek)
  return Array.from({ length: 7 }, (_, i) => addDaysKey(start, i))
}

export function monthKeyOf(key: string): string {
  return key.slice(0, 7)
}

export function monthEndKey(key: string): string {
  const d = utc(`${key.slice(0, 7)}-01`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}

function prevMonthKey(month: string): string {
  const d = utc(`${month}-01`)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString().slice(0, 7)
}

/** The day, week or month a habit is counted in */
export function periodRange(frequency: HabitFrequency, key: string): { from: string; to: string } {
  if (frequency === "WEEKLY") {
    const from = weekStartKey(key)
    return { from, to: addDaysKey(from, 6) }
  }
  if (frequency === "MONTHLY") return { from: `${key.slice(0, 7)}-01`, to: monthEndKey(key) }
  return { from: key, to: key }
}

// ---------- habits ----------

export const STREAK_UNIT: Record<HabitFrequency, string> = {
  DAILY: "dni",
  WEEKLY: "tyg.",
  MONTHLY: "mies.",
}

/** "5 dni", "1 dzień", "3 tyg." */
export function formatStreak(count: number, frequency: HabitFrequency): string {
  if (frequency === "DAILY") return `${count} ${plural(count, "dzień", "dni", "dni")}`
  return `${count} ${STREAK_UNIT[frequency]}`
}

/** How many times in the period count as "done": every day, N times a week, N times a month */
export function habitTarget(frequency: HabitFrequency, targetCount: number): number {
  return frequency === "DAILY" ? 1 : Math.max(1, targetCount || 1)
}

export function habitRhythmLabel(frequency: HabitFrequency, targetCount: number): string {
  if (frequency === "DAILY") return "codziennie"
  const n = habitTarget(frequency, targetCount)
  return frequency === "WEEKLY" ? `${n}× w tygodniu` : `${n}× w miesiącu`
}

/**
 * Streak counted from the days the habit was really done:
 * - daily: days in a row; weekly / monthly: weeks / months in a row with the target met
 * - the running day (week, month) not done yet does not break it - it is still open
 */
export function computeStreak(
  frequency: HabitFrequency,
  targetCount: number,
  doneDays: Iterable<string>,
  today: string
): { current: number; longest: number } {
  let met: Set<string>
  let currentPeriod: string
  let prev: (period: string) => string

  if (frequency === "DAILY") {
    met = new Set(doneDays)
    currentPeriod = today
    prev = (p) => addDaysKey(p, -1)
  } else {
    const target = habitTarget(frequency, targetCount)
    const toPeriod = frequency === "WEEKLY" ? weekStartKey : monthKeyOf
    const counts = new Map<string, number>()
    for (const day of new Set(doneDays)) {
      const period = toPeriod(day)
      counts.set(period, (counts.get(period) ?? 0) + 1)
    }
    met = new Set<string>()
    counts.forEach((count, period) => {
      if (count >= target) met.add(period)
    })
    currentPeriod = toPeriod(today)
    prev = frequency === "WEEKLY" ? (p) => addDaysKey(p, -7) : prevMonthKey
  }

  let current = 0
  let cursor = met.has(currentPeriod) ? currentPeriod : prev(currentPeriod)
  while (met.has(cursor)) {
    current++
    cursor = prev(cursor)
  }

  let longest = 0
  let run = 0
  let last: string | null = null
  for (const period of Array.from(met).sort()) {
    run = last !== null && prev(period) === last ? run + 1 : 1
    if (run > longest) longest = run
    last = period
  }

  return { current, longest: Math.max(longest, current) }
}

// ---------- challenges ----------

export interface ProgressEntry {
  date: string | Date
  value: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Progress of a challenge from its entries:
 * - numeric: sum of the values
 * - weekly: weeks (from the start week on) with at least `weeklyTarget` in them
 * - monthly: months with an entry; daily: days with an entry
 */
export function challengeProgress(
  type: ChallengeType,
  entries: ProgressEntry[],
  startDate: string | Date,
  weeklyTarget?: number | null
): number {
  if (type === "WEEKLY_HABIT") {
    const target = Math.max(1, weeklyTarget || 1)
    const startWeek = weekStartKey(dayKeyOf(startDate))
    const perWeek = new Map<string, number>()
    for (const entry of entries) {
      const week = weekStartKey(dayKeyOf(entry.date))
      if (week < startWeek) continue
      perWeek.set(week, (perWeek.get(week) ?? 0) + entry.value)
    }
    let weeks = 0
    perWeek.forEach((sum) => {
      if (sum >= target) weeks++
    })
    return weeks
  }
  if (type === "MONTHLY_GOAL") return new Set(entries.map((e) => monthKeyOf(dayKeyOf(e.date)))).size
  if (type === "DAILY_GOAL") return new Set(entries.map((e) => dayKeyOf(e.date))).size
  return round2(entries.reduce((sum, e) => sum + e.value, 0))
}

/** Sum of the entries of the week of `day` (weekly challenges: "this week 2/3") */
export function weekSum(entries: ProgressEntry[], day: string): number {
  const week = weekStartKey(day)
  return round2(
    entries.reduce((sum, e) => (weekStartKey(dayKeyOf(e.date)) === week ? sum + e.value : sum), 0)
  )
}

export type PaceStatus = "done" | "upcoming" | "over" | "ahead" | "behind"

export interface Pace {
  status: PaceStatus
  /** Where the progress should be by the end of yesterday when going evenly to the target */
  expected: number
  /** current - expected (negative - behind the plan) */
  delta: number
  /** Days to the end, today included (0 after the end) */
  daysLeft: number
  remaining: number
  /** How much a week is needed from now to make it; null after the end */
  perWeekNeeded: number | null
}

export function challengePace(args: {
  startDate: string | Date
  endDate: string | Date
  target: number
  current: number
  today: string
}): Pace {
  const start = dayKeyOf(args.startDate)
  const end = dayKeyOf(args.endDate)
  const totalDays = Math.max(1, diffDays(start, end) + 1)
  // Days already over - today still counts as open, so the first day of a challenge isn't "behind"
  const elapsed = Math.min(totalDays, Math.max(0, diffDays(start, args.today)))
  const expected = round2((args.target * elapsed) / totalDays)
  const delta = round2(args.current - expected)
  const daysLeft = Math.max(0, diffDays(args.today, end) + 1)
  const remaining = Math.max(0, round2(args.target - args.current))

  let status: PaceStatus
  if (args.current >= args.target) status = "done"
  else if (args.today < start) status = "upcoming"
  else if (args.today > end) status = "over"
  else status = delta >= 0 ? "ahead" : "behind"

  return {
    status,
    expected,
    delta,
    daysLeft,
    remaining,
    perWeekNeeded: daysLeft > 0 ? round2(remaining / (daysLeft / 7)) : null,
  }
}

// ---------- display ----------

/** 1250.5 -> "1 250,5"; whole numbers without the fraction */
export function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded.toLocaleString("pl-PL", { maximumFractionDigits: 1 })
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Polish plural: plural(5, "dzień", "dni", "dni") */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n)
  if (abs === 1) return one
  const lastTwo = abs % 100
  const last = abs % 10
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few
  return many
}
