"use client"

import { useMemo } from "react"
import { CalendarClock } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { dayNumber, isValidDay, weekdayOf } from "@/lib/calendar"
import {
  DEFAULT_RECURRENCE,
  NTH_MASCULINE,
  WEEKDAY_NAMES,
  anchorRecurrence,
  describeTaskRecurrence,
  firstOccurrenceFrom,
  formatDayShort,
  nextOccurrences,
  type TaskFrequency,
  type TaskRecurrence,
  type WeekendShift,
} from "@/lib/task-recurrence"
import { cn } from "@/lib/utils"

export interface RecurrenceValue {
  recurrence: TaskRecurrence
  start: string // yyyy-MM-dd, the rule counts from this day
}

const FREQUENCIES: { value: TaskFrequency; label: string }[] = [
  { value: "DAILY", label: "Codziennie / co kilka dni" },
  { value: "WEEKDAYS", label: "W dni robocze (pon–pt)" },
  { value: "WEEKLY", label: "Co tydzień / w wybrane dni" },
  { value: "MONTHLY", label: "Co miesiąc" },
  { value: "YEARLY", label: "Co roku" },
  { value: "SPRINT_END", label: "Przed końcem sprintu" },
  { value: "PERIOD_END", label: "Przed końcem okresu (kwartału)" },
]

const WEEKDAY_LETTERS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]
const INTERVAL_UNITS: Partial<Record<TaskFrequency, string>> = {
  DAILY: "dni",
  WEEKLY: "tyg.",
  MONTHLY: "mies.",
  YEARLY: "lat",
}
const WORKDAY = 7 // "dzień roboczy" in the weekday select

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function dayOfMonth(day: string) {
  return new Date(dayNumber(day) * 86_400_000).getUTCDate()
}

// New rule for a frequency, with sensible defaults taken from the start day
export function recurrenceForFrequency(freq: TaskFrequency, start: string, previous?: TaskRecurrence): TaskRecurrence {
  const base: TaskRecurrence = { ...DEFAULT_RECURRENCE, until: previous?.until ?? null }
  switch (freq) {
    case "WEEKLY":
      return { ...base, freq, weekdays: [weekdayOf(start)] }
    case "MONTHLY":
      return { ...base, freq, monthly: { type: "day", day: dayOfMonth(start) } }
    case "SPRINT_END":
    case "PERIOD_END":
      return { ...base, freq, daysBefore: freq === "SPRINT_END" ? 3 : 7 }
    default:
      return { ...base, freq }
  }
}

export function defaultRecurrenceValue(start = localToday()): RecurrenceValue {
  return { recurrence: recurrenceForFrequency("DAILY", start), start }
}

interface RecurrencePickerProps {
  value: RecurrenceValue
  onChange: (value: RecurrenceValue) => void
  // Hide the start field when the form already has a date (e.g. the task's date)
  hideStart?: boolean
  // Sprint / period rules make sense only in the work space
  allowDeadlines?: boolean
}

// Everything about "when": frequency, day of the month / week, every N, from / until, preview
export function RecurrencePicker({ value, onChange, hideStart, allowDeadlines = true }: RecurrencePickerProps) {
  const { recurrence: r, start } = value
  const update = (patch: Partial<TaskRecurrence>) => onChange({ start, recurrence: { ...r, ...patch } })

  const preview = useMemo(() => {
    if (!isValidDay(start)) return { text: "", next: [] as string[] }
    const today = localToday()
    const { recurrence } = anchorRecurrence(r, start, undefined, today)
    const deadline = r.freq === "SPRINT_END" || r.freq === "PERIOD_END"
    return {
      text: describeTaskRecurrence(recurrence),
      next: deadline
        ? []
        : nextOccurrences(recurrence, firstOccurrenceFrom(recurrence, start, undefined, today) ?? today, 4),
    }
  }, [r, start])

  const monthlyMode = r.monthly.type === "day" ? (r.monthly.day === -1 ? "last" : "day") : "nth"
  const nth = r.monthly.type === "day" ? 1 : r.monthly.nth
  const nthWeekday = r.monthly.type === "weekday" ? r.monthly.weekday : r.monthly.type === "workday" ? WORKDAY : weekdayOf(start)
  const showWeekend = (r.freq === "MONTHLY" && r.monthly.type === "day") || r.freq === "YEARLY"

  const numberInput = (val: number, set: (n: number) => void, min: number, max: number, label: string) => (
    <Input
      type="number"
      min={min}
      max={max}
      value={val}
      onChange={(e) => set(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
      className="h-9 w-16"
      aria-label={label}
    />
  )

  const radio = (checked: boolean, onSelect: () => void, children: React.ReactNode) => (
    <label
      className={cn(
        "flex cursor-pointer flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        checked ? "bg-muted" : "hover:bg-muted/60"
      )}
    >
      <input type="radio" className="h-4 w-4 accent-primary" checked={checked} onChange={onSelect} />
      {children}
    </label>
  )

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <Select
        value={r.freq}
        onValueChange={(freq) => onChange({ start, recurrence: recurrenceForFrequency(freq as TaskFrequency, start, r) })}
      >
        <SelectTrigger className="h-9 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FREQUENCIES.filter((f) => allowDeadlines || (f.value !== "SPRINT_END" && f.value !== "PERIOD_END")).map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {INTERVAL_UNITS[r.freq] && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Co</span>
          {numberInput(r.interval, (interval) => update({ interval }), 1, 99, "Co ile")}
          <span className="text-muted-foreground">{INTERVAL_UNITS[r.freq]}</span>
        </div>
      )}

      {r.freq === "WEEKLY" && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">W które dni</div>
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_LETTERS.map((letter, day) => {
              const active = r.weekdays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={active}
                  title={WEEKDAY_NAMES[day]}
                  onClick={() => {
                    const weekdays = active ? r.weekdays.filter((d) => d !== day) : [...r.weekdays, day]
                    if (weekdays.length > 0) update({ weekdays })
                  }}
                  className={cn(
                    "h-8 w-9 rounded-full text-xs font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-background border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {r.freq === "MONTHLY" && (
        <div className="space-y-1" role="radiogroup" aria-label="Który dzień miesiąca">
          {radio(
            monthlyMode === "day",
            () => update({ monthly: { type: "day", day: dayOfMonth(start) } }),
            <>
              Dnia
              <Select
                value={String(r.monthly.type === "day" && r.monthly.day > 0 ? r.monthly.day : dayOfMonth(start))}
                onValueChange={(v) => update({ monthly: { type: "day", day: Number(v) } })}
              >
                <SelectTrigger className="h-8 w-20 bg-background" onClick={() => monthlyMode !== "day" && update({ monthly: { type: "day", day: dayOfMonth(start) } })}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}.
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">(w krótszym miesiącu – ostatniego dnia)</span>
            </>
          )}
          {radio(monthlyMode === "last", () => update({ monthly: { type: "day", day: -1 } }), "Ostatniego dnia miesiąca")}
          {radio(
            monthlyMode === "nth",
            () => update({ monthly: { type: "workday", nth: -1 } }),
            <>
              W
              <Select
                value={String(nth)}
                onValueChange={(v) =>
                  update({
                    monthly:
                      nthWeekday === WORKDAY
                        ? { type: "workday", nth: Number(v) }
                        : { type: "weekday", nth: Number(v), weekday: nthWeekday },
                  })
                }
              >
                <SelectTrigger className="h-8 w-28 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, -1].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {NTH_MASCULINE[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(nthWeekday)}
                onValueChange={(v) =>
                  update({
                    monthly:
                      Number(v) === WORKDAY
                        ? { type: "workday", nth }
                        : { type: "weekday", nth, weekday: Number(v) },
                  })
                }
              >
                <SelectTrigger className="h-8 w-36 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(WORKDAY)}>dzień roboczy</SelectItem>
                  {WEEKDAY_NAMES.map((name, day) => (
                    <SelectItem key={day} value={String(day)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      )}

      {(r.freq === "SPRINT_END" || r.freq === "PERIOD_END") && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            {numberInput(r.daysBefore, (daysBefore) => update({ daysBefore }), 0, 60, "Ile dni przed końcem")}
            <span className="text-muted-foreground">
              dni przed końcem {r.freq === "SPRINT_END" ? "sprintu" : "okresu"} (0 = w ostatni dzień)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Terminy wynikają z dat sprintów / kwartałów w module Cele.</p>
        </div>
      )}

      {showWeekend && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Gdy wypada w weekend</span>
          <Select
            value={r.weekend ?? "KEEP"}
            onValueChange={(v) => update({ weekend: v === "KEEP" ? null : (v as WeekendShift) })}
          >
            <SelectTrigger className="h-8 w-48 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="KEEP">zostaw w weekend</SelectItem>
              <SelectItem value="BEFORE">przenieś na piątek przed</SelectItem>
              <SelectItem value="AFTER">przenieś na poniedziałek po</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {!hideStart && (
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">{r.freq === "YEARLY" ? "Data" : "Od"}</span>
            <Input
              type="date"
              value={start}
              onChange={(e) => e.target.value && onChange({ recurrence: r, start: e.target.value })}
              className="h-9 w-auto bg-background"
            />
          </label>
        )}
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Do</span>
          <Input
            type="date"
            value={r.until ?? ""}
            min={start}
            onChange={(e) => update({ until: e.target.value || null })}
            className="h-9 w-auto bg-background"
          />
          {r.until ? (
            <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => update({ until: null })}>
              bez końca
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">(puste = bez końca)</span>
          )}
        </label>
      </div>

      {preview.text && (
        <div className="flex gap-2 rounded-md bg-background px-3 py-2 text-sm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="font-medium">{preview.text}</div>
            {preview.next.length > 0 && (
              <div className="text-xs text-muted-foreground">Najbliższe: {preview.next.map(formatDayShort).join(" · ")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
