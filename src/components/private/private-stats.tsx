"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  addDaysKey,
  dateOfKey,
  formatMinutes,
  plural,
  formatStreak,
  todayKey,
  weekStartKey,
  type HabitFrequency,
} from "@/lib/tracking"

interface HabitYear {
  id: string
  name: string
  color: string
  frequency: HabitFrequency
  targetCount: number
  unit: string | null
  isActive: boolean
  /** Days done in the year, yyyy-MM-dd */
  days: string[]
  minutes: number
  count: number
  currentStreak: number
  longestStreak: number
}

interface WeekStat {
  week: string
  habitMinutes: number
  sportMinutes: number
  habitDone: number
  workouts: number
}

interface PrivateStatsData {
  year: number
  today: string
  habits: HabitYear[]
  weeks: WeekStat[]
  sport: {
    total: number
    minutes: number
    byType: { id: string; name: string; color: string; count: number; minutes: number }[]
    byMonth: number[]
    bodyParts: { name: string; count: number }[]
  }
  steps: { total: number; days: number; average: number }
  totals: { activeDays: number; habitDone: number; habitMinutes: number }
}

const hours = (minutes: number) => (minutes ? formatMinutes(minutes) : "–")

// ---------- stat tile ----------

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums md:text-2xl">{value}</div>
      {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

// ---------- columns (weeks, months) ----------

interface Column {
  key: string
  /** Under the column; empty - no label */
  label: string
  /** Read out when the column is picked: "3-9 lis" */
  title: string
  segments: { name: string; value: number; color: string }[]
}

/**
 * Columns stacked from the baseline. Pointing at (or tapping) a column reads its
 * numbers out above the chart - the newest one is read out to start with.
 */
function Columns({
  columns,
  formatValue,
  legend,
  restKey,
}: {
  columns: Column[]
  formatValue: (value: number) => string
  legend: boolean
  /** The column read out while none is picked; default - the last one */
  restKey?: string
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const active =
    columns.find((c) => c.key === picked) ?? columns.find((c) => c.key === restKey) ?? columns[columns.length - 1]
  const max = Math.max(1, ...columns.map((c) => c.segments.reduce((sum, s) => sum + s.value, 0)))
  const total = (column: Column) => column.segments.reduce((sum, s) => sum + s.value, 0)

  return (
    <div>
      <div className="mb-3 flex min-h-[2.5rem] flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
        <span className="font-medium">{active.title}</span>
        {active.segments.map((segment) => (
          <span key={segment.name} className="flex items-center gap-1.5 text-muted-foreground">
            {legend && <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: segment.color }} />}
            {legend && `${segment.name} `}
            <span className="font-medium tabular-nums text-foreground">{formatValue(segment.value)}</span>
          </span>
        ))}
      </div>
      <div className="flex h-36 items-end gap-1 border-b" onPointerLeave={() => setPicked(null)}>
        {columns.map((column) => (
          <button
            key={column.key}
            type="button"
            onPointerEnter={() => setPicked(column.key)}
            onFocus={() => setPicked(column.key)}
            onClick={() => setPicked(column.key)}
            aria-label={`${column.title}: ${column.segments.map((s) => `${s.name} ${formatValue(s.value)}`).join(", ")}`}
            className={cn(
              "flex h-full min-w-0 flex-1 flex-col-reverse items-stretch justify-start gap-0.5 rounded-t-sm transition-opacity",
              picked && picked !== column.key && "opacity-50"
            )}
          >
            {total(column) === 0 ? (
              <span className="h-0.5 rounded-full bg-muted-foreground/20" />
            ) : (
              column.segments
                .filter((segment) => segment.value > 0)
                .map((segment, i, shown) => (
                  <span
                    key={segment.name}
                    className={cn("mx-auto w-full max-w-[28px]", i === shown.length - 1 && "rounded-t-[4px]")}
                    style={{ height: `${(segment.value / max) * 100}%`, minHeight: 3, backgroundColor: segment.color }}
                  />
                ))
            )}
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {columns.map((column) => (
          <span key={column.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
            {column.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------- ranked bars ----------

function BarList({ rows, color }: { rows: { key: string; label: string; value: number; text: string; dot?: string }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              {row.dot && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: row.dot }} />}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="flex-shrink-0 tabular-nums text-muted-foreground">{row.text}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---------- a year of a habit in squares ----------

const CELL = 11
const GAP = 2
const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]

const HabitYearCalendar = memo(function HabitYearCalendar({ habit, year, today }: { habit: HabitYear; year: number; today: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  const done = useMemo(() => new Set(habit.days), [habit.days])

  const { cells, monthLabels, width } = useMemo(() => {
    const first = `${year}-01-01`
    const last = `${year}-12-31`
    const gridStart = weekStartKey(first)
    const out: { day: string; x: number; y: number }[] = []
    const labels: { month: number; x: number }[] = []
    let day = gridStart
    let index = 0
    while (day <= last) {
      if (day >= first) {
        const column = Math.floor(index / 7)
        out.push({ day, x: column * (CELL + GAP), y: (index % 7) * (CELL + GAP) })
        if (day.endsWith("-01")) labels.push({ month: Number(day.slice(5, 7)) - 1, x: column * (CELL + GAP) })
      }
      day = addDaysKey(day, 1)
      index++
    }
    return { cells: out, monthLabels: labels, width: Math.ceil(index / 7) * (CELL + GAP) }
  }, [year])

  // On a phone the year is wider than the screen - it opens at today, not at January
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const todayCell = cells.find((c) => c.day === today)
    el.scrollLeft = todayCell ? Math.max(0, todayCell.x - el.clientWidth + 4 * (CELL + GAP)) : 0
  }, [cells, today])

  const height = 7 * (CELL + GAP) + 14

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
          {habit.name}
          {!habit.isActive && <span className="text-xs font-normal text-muted-foreground">(zakończony)</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {habit.days.length} {plural(habit.days.length, "dzień", "dni", "dni")}
          {habit.unit && habit.count > 0 && ` · ${habit.count.toLocaleString("pl-PL")} ${habit.unit}`}
          {habit.minutes > 0 && ` · ${formatMinutes(habit.minutes)}`}
        </span>
        {habit.isActive && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Flame className={cn("h-3.5 w-3.5", habit.currentStreak > 0 && "text-orange-500")} />
            seria {formatStreak(habit.currentStreak, habit.frequency)} · rekord {habit.longestStreak}
          </span>
        )}
      </div>
      <div ref={scroller} className="overflow-x-auto pb-1" style={{ scrollBehavior: "auto" }}>
        <svg width={width} height={height} role="img" aria-label={`${habit.name}: dni wykonane w ${year}`} className="block">
          {monthLabels.map((label) => (
            <text key={label.month} x={label.x} y={9} className="fill-muted-foreground text-[9px]">
              {MONTHS[label.month]}
            </text>
          ))}
          {cells.map((cell) => {
            const isDone = done.has(cell.day)
            return (
              <rect
                key={cell.day}
                x={cell.x}
                y={cell.y + 14}
                width={CELL}
                height={CELL}
                rx={2.5}
                fill={isDone ? habit.color : "var(--viz-empty)"}
                opacity={!isDone && cell.day > today ? 0.45 : 1}
                stroke={cell.day === today ? "hsl(var(--foreground))" : undefined}
                strokeWidth={cell.day === today ? 1 : undefined}
              >
                <title>
                  {format(dateOfKey(cell.day), "EEEE, d MMMM", { locale: pl })}
                  {isDone ? " - zrobione" : ""}
                </title>
              </rect>
            )
          })}
        </svg>
      </div>
    </div>
  )
})

// ---------- page section ----------

/** Statistics of the private trackers: a year of habits, time per week, sport by type, month and muscle group */
export function PrivateStats() {
  const today = todayKey()
  const thisYear = Number(today.slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const [metric, setMetric] = useState<"minutes" | "count">("minutes")
  const { data, isLoading } = useSWR<PrivateStatsData>(`/api/stats/private?year=${year}&today=${today}`, {
    keepPreviousData: true,
  })

  // Nothing timed in these weeks - counts say more than twelve empty columns
  const hasMinutes = !!data?.weeks.some((w) => w.habitMinutes + w.sportMinutes > 0)
  const shownMetric = hasMinutes ? metric : "count"

  const weekColumns = useMemo<Column[]>(
    () =>
      (data?.weeks ?? []).map((week, i, all) => {
        const start = dateOfKey(week.week)
        const end = dateOfKey(addDaysKey(week.week, 6))
        return {
          key: week.week,
          // Every third week is labelled - twelve dates don't fit a phone
          label: (all.length - 1 - i) % 3 === 0 ? format(start, "d MMM", { locale: pl }) : "",
          title: `${format(start, "d MMM", { locale: pl })} – ${format(end, "d MMM", { locale: pl })}`,
          segments: [
            { name: "Nawyki", value: shownMetric === "minutes" ? week.habitMinutes : week.habitDone, color: "var(--viz-1)" },
            { name: "Sport", value: shownMetric === "minutes" ? week.sportMinutes : week.workouts, color: "var(--viz-2)" },
          ],
        }
      }),
    [data?.weeks, shownMetric]
  )

  const monthColumns = useMemo<Column[]>(
    () =>
      (data?.sport.byMonth ?? []).map((count, month) => ({
        key: String(month),
        label: MONTHS[month],
        title: format(new Date(Date.UTC(year, month, 1)), "LLLL", { locale: pl }),
        segments: [{ name: "Treningi", value: count, color: "var(--viz-2)" }],
      })),
    [data?.sport.byMonth, year]
  )

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!data) return null

  const empty = data.habits.length === 0 && data.sport.total === 0 && data.steps.days === 0

  return (
    <div className="viz space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Nawyki i sport</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setYear((y) => y - 1)} aria-label="Poprzedni rok">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="w-14 text-center font-medium tabular-nums">{year}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            disabled={year >= thisYear}
            onClick={() => setYear((y) => y + 1)}
            aria-label="Następny rok"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {empty ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            Brak wpisów w {year}. Odhaczaj nawyki i treningi na ekranie Dziś - tu zobaczysz z nich rok w kratkach,
            serie i czas tydzień po tygodniu.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile label="Aktywne dni" value={data.totals.activeDays.toString()} hint="z nawykiem lub treningiem" />
            <Tile label="Odhaczone nawyki" value={data.totals.habitDone.toLocaleString("pl-PL")} />
            <Tile label="Czas na nawyki" value={hours(data.totals.habitMinutes)} />
            <Tile label="Treningi" value={data.sport.total.toString()} hint={data.sport.minutes ? formatMinutes(data.sport.minutes) : undefined} />
            <Tile
              label="Kroki dziennie"
              value={data.steps.average ? data.steps.average.toLocaleString("pl-PL") : "–"}
              hint={data.steps.days ? `średnio z ${data.steps.days} ${plural(data.steps.days, "dnia", "dni", "dni")}` : undefined}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
              <CardTitle className="text-base">Ostatnie 12 tygodni</CardTitle>
              {hasMinutes && (
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
                  {(["minutes", "count"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMetric(value)}
                      className={cn(
                        "h-9 rounded-md px-3 font-medium transition-colors",
                        metric === value ? "bg-background shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      {value === "minutes" ? "Czas" : "Liczba"}
                    </button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Columns
                columns={weekColumns}
                legend
                formatValue={(value) => (shownMetric === "minutes" ? hours(value) : value.toString())}
              />
            </CardContent>
          </Card>

          {data.habits.length > 0 && (
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-base">Rok w kratkach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 px-4 pb-4">
                {data.habits.map((habit) => (
                  <HabitYearCalendar key={habit.id} habit={habit} year={year} today={today} />
                ))}
              </CardContent>
            </Card>
          )}

          {data.sport.total > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="px-4 pb-2 pt-4">
                  <CardTitle className="text-base">Treningi w miesiącach</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Columns
                    columns={monthColumns}
                    legend={false}
                    restKey={year === thisYear ? String(Number(today.slice(5, 7)) - 1) : undefined}
                    formatValue={(value) => `${value} ${plural(value, "trening", "treningi", "treningów")}`} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="px-4 pb-2 pt-4">
                  <CardTitle className="text-base">Co trenujesz</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 px-4 pb-4">
                  <BarList
                    color="var(--viz-2)"
                    rows={data.sport.byType.map((type) => ({
                      key: type.id,
                      label: type.name,
                      dot: type.color,
                      value: type.count,
                      text: `${type.count}×${type.minutes ? ` · ${formatMinutes(type.minutes)}` : ""}`,
                    }))}
                  />
                  {data.sport.bodyParts.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">Partie na siłowni</div>
                      <BarList
                        color="var(--viz-2)"
                        rows={data.sport.bodyParts.map((part) => ({
                          key: part.name,
                          label: part.name,
                          value: part.count,
                          text: `${part.count}×`,
                        }))}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
