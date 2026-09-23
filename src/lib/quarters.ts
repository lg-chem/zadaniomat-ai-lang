/**
 * Calendar quarter planning: 6 two-week sprints from the first day of the quarter,
 * the remaining 6-8 days are the quarter review week.
 *
 * Dates are handled as day keys ("YYYY-MM-DD"). Sprint and period dates are stored
 * as UTC midnight of the calendar day, so the day key of a stored date is its UTC date.
 * Pure functions only - safe to use on both the client and the server.
 */

export const SPRINTS_PER_QUARTER = 6
export const SPRINT_DAYS = 14
export const RECOMMENDED_MAX_GOALS = 3
export const RECOMMENDED_MAX_COMMITMENTS = 5
export const QUARTER_WEEKS = 13

const DAY_MS = 24 * 60 * 60 * 1000

export interface QuarterRef {
  year: number
  quarter: number // 1-4
}

// ==================== DAY KEYS ====================

/** Day key of a stored date (UTC calendar day) */
export function toDayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

/** Day key of "today" in the local time zone */
export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** UTC midnight Date for a day key (the format stored in the database) */
export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`)
}

/** Local-time Date for a day key - use for display formatting */
export function dayKeyToLocalDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Today's calendar day as stored in the database (UTC midnight) - for server-side date filters */
export function utcToday(): Date {
  return dayKeyToDate(toDayKey(new Date()))
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(dayKeyToDate(value).getTime())
}

export function addDaysToKey(key: string, days: number): string {
  return toDayKey(new Date(dayKeyToDate(key).getTime() + days * DAY_MS))
}

/** Number of days from a to b (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayKeyToDate(b).getTime() - dayKeyToDate(a).getTime()) / DAY_MS)
}

/** Monday of the week that contains the day */
export function weekStartKey(key: string): string {
  const dow = dayKeyToDate(key).getUTCDay() // 0 = Sunday
  return addDaysToKey(key, -((dow + 6) % 7))
}

// ==================== QUARTERS ====================

export function quarterOf(key: string): QuarterRef {
  const [year, month] = key.split("-").map(Number)
  return { year, quarter: Math.floor((month - 1) / 3) + 1 }
}

export function shiftQuarter(ref: QuarterRef, delta: number): QuarterRef {
  const index = ref.year * 4 + (ref.quarter - 1) + delta
  return { year: Math.floor(index / 4), quarter: (index % 4) + 1 }
}

export function sameQuarter(a: QuarterRef, b: QuarterRef): boolean {
  return a.year === b.year && a.quarter === b.quarter
}

/** SWR key of the quarter view */
export function quarterApiKey(ref: QuarterRef): string {
  return `/api/quarters?year=${ref.year}&quarter=${ref.quarter}`
}

export function quarterLabel(ref: QuarterRef): string {
  return `Q${ref.quarter} ${ref.year}`
}

export function quarterStartKey(ref: QuarterRef): string {
  return `${ref.year}-${String((ref.quarter - 1) * 3 + 1).padStart(2, "0")}-01`
}

export function quarterEndKey(ref: QuarterRef): string {
  // Day 0 of the month after the quarter = last day of the quarter
  return toDayKey(new Date(Date.UTC(ref.year, ref.quarter * 3, 0)))
}

export interface SprintSlot {
  number: number
  name: string
  startKey: string
  endKey: string
}

export interface QuarterSchedule {
  ref: QuarterRef
  startKey: string
  endKey: string
  sprints: SprintSlot[]
  reviewStartKey: string
  totalDays: number
}

export function buildQuarterSchedule(ref: QuarterRef): QuarterSchedule {
  const startKey = quarterStartKey(ref)
  const endKey = quarterEndKey(ref)
  const sprints: SprintSlot[] = Array.from({ length: SPRINTS_PER_QUARTER }, (_, i) => {
    const sprintStart = addDaysToKey(startKey, i * SPRINT_DAYS)
    return {
      number: i + 1,
      name: `Sprint ${i + 1}`,
      startKey: sprintStart,
      endKey: addDaysToKey(sprintStart, SPRINT_DAYS - 1),
    }
  })
  return {
    ref,
    startKey,
    endKey,
    sprints,
    reviewStartKey: addDaysToKey(startKey, SPRINTS_PER_QUARTER * SPRINT_DAYS),
    totalDays: daysBetween(startKey, endKey) + 1,
  }
}

/** Week of the quarter (1-13); weeks 1-12 are sprints, week 13 is the review */
export function quarterWeek(ref: QuarterRef, today: string): number {
  const days = daysBetween(quarterStartKey(ref), today)
  return Math.min(QUARTER_WEEKS, Math.max(1, Math.floor(days / 7) + 1))
}

/** Share of the quarter that has passed (0-1), counting today as done */
export function quarterElapsed(ref: QuarterRef, today: string): number {
  const schedule = buildQuarterSchedule(ref)
  if (today < schedule.startKey) return 0
  if (today > schedule.endKey) return 1
  return (daysBetween(schedule.startKey, today) + 1) / schedule.totalDays
}

export type QuarterPhase = "upcoming" | "sprints" | "review" | "past"

export function quarterPhase(ref: QuarterRef, today: string): QuarterPhase {
  const schedule = buildQuarterSchedule(ref)
  if (today < schedule.startKey) return "upcoming"
  if (today > schedule.endKey) return "past"
  if (today >= schedule.reviewStartKey) return "review"
  return "sprints"
}

/**
 * Quarter shown by default: the current one, but in its last two weeks
 * the next one if the current quarter was never planned.
 */
export function defaultQuarter(today: string, currentExists: boolean): QuarterRef {
  const current = quarterOf(today)
  const daysLeft = daysBetween(today, quarterEndKey(current))
  if (!currentExists && daysLeft < 14) return shiftQuarter(current, 1)
  return current
}

// ==================== PROGRESS & PACE ====================

export interface KeyResultValues {
  startValue: number
  targetValue: number
  currentValue: number
}

/** Progress of a key result (0-1), works for increasing and decreasing targets */
export function keyResultProgress(kr: KeyResultValues): number {
  const range = kr.targetValue - kr.startValue
  if (range === 0) return kr.currentValue === kr.targetValue ? 1 : 0
  return Math.min(1, Math.max(0, (kr.currentValue - kr.startValue) / range))
}

/** Value the key result should have today on a linear plan */
export function keyResultExpectedValue(kr: KeyResultValues, elapsed: number): number {
  return kr.startValue + (kr.targetValue - kr.startValue) * elapsed
}

/** Average progress of the key results, null when the goal has none */
export function goalProgress(keyResults: KeyResultValues[]): number | null {
  if (keyResults.length === 0) return null
  return keyResults.reduce((sum, kr) => sum + keyResultProgress(kr), 0) / keyResults.length
}

export type PaceStatus = "done" | "not_started" | "on_track" | "at_risk" | "off_track"

export function paceStatus(progress: number, elapsed: number): PaceStatus {
  if (progress >= 1) return "done"
  if (elapsed <= 0) return "not_started"
  if (progress >= elapsed - 0.05 || progress / elapsed >= 0.9) return "on_track"
  if (progress / elapsed >= 0.6) return "at_risk"
  return "off_track"
}

export const PACE_LABELS: Record<PaceStatus, string> = {
  done: "Osiągnięty",
  not_started: "Przed startem",
  on_track: "W tempie",
  at_risk: "Lekko za tempem",
  off_track: "Za tempem",
}

/** Lead measure execution for one week (0-1), null when not measurable */
export function leadExecution(leadActual: number | null | undefined, leadTarget: number | null | undefined): number | null {
  if (leadActual == null || !leadTarget || leadTarget <= 0) return null
  return Math.min(1, leadActual / leadTarget)
}

// ==================== FORMATTING ====================

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value)
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

// ==================== API PAYLOAD ====================

export interface QuarterKeyResult {
  id: string
  title: string
  unit: string | null
  startValue: number
  targetValue: number
  currentValue: number
  order: number
  entries: { value: number; createdAt: string }[]
}

export interface QuarterCheckIn {
  weekStart: string // day key
  confidence: number | null
  leadActual: number | null
  note: string | null
}

export interface QuarterGoal {
  id: string
  title: string
  why: string | null
  obstacle: string | null
  ifThenPlan: string | null
  leadMeasure: string | null
  leadTarget: number | null
  isCompleted: boolean
  score: number | null
  reviewNote: string | null
  carriedOver: boolean
  createdAt: string
  category: { id: string; name: string; color: string } | null
  keyResults: QuarterKeyResult[]
  checkIns: QuarterCheckIn[]
  trackedSeconds: number
}

export interface SprintCommitment {
  id: string
  title: string
  isCompleted: boolean
  carriedOver: boolean
  parentGoalId: string | null
  taskCount: number
  completedTaskCount: number
  trackedSeconds: number
}

export interface QuarterSprint {
  id: string
  name: string
  number: number
  startKey: string
  endKey: string
  sprintGoal: string | null
  plannedAt: string | null
  closedAt: string | null
  retrospective: {
    wentWell: string[]
    needsImprovement: string[]
    actionItems: string[]
    notes: string | null
  } | null
  commitments: SprintCommitment[]
}

export interface QuarterPayload {
  id: string
  name: string
  year: number
  quarter: number
  startKey: string
  endKey: string
  reviewNotes: string | null
  reviewedAt: string | null
  goals: QuarterGoal[]
  sprints: QuarterSprint[]
}

export interface SprintHistory {
  sprints: number
  done: number
  total: number
}

export interface QuarterResponse {
  quarter: QuarterPayload | null
  history: SprintHistory
  hasQuarters: boolean // The user has planned any quarter - uses the goals module
}

/** The sprint that contains today, if any */
export function currentSprint(sprints: QuarterSprint[], today: string): QuarterSprint | null {
  return sprints.find((s) => s.startKey <= today && today <= s.endKey) ?? null
}

/** The latest sprint that has already ended */
export function lastEndedSprint(sprints: QuarterSprint[], today: string): QuarterSprint | null {
  const ended = sprints.filter((s) => s.endKey < today)
  return ended.length > 0 ? ended[ended.length - 1] : null
}

export function checkInForWeek(goal: QuarterGoal, weekStart: string): QuarterCheckIn | null {
  return goal.checkIns.find((c) => c.weekStart === weekStart) ?? null
}

export function latestCheckIn(goal: QuarterGoal): QuarterCheckIn | null {
  return goal.checkIns.length > 0 ? goal.checkIns[goal.checkIns.length - 1] : null
}
