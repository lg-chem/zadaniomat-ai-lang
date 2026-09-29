"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { pl } from "date-fns/locale"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Keyboard,
  LayoutGrid,
  Loader2,
  Plus,
  Repeat2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as MiniCalendar } from "@/components/ui/calendar"
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog"
import { EventDialog, type EventDraft } from "@/components/calendar/event-dialog"
import { ItemPreviewDialog, type PreviewTarget } from "@/components/calendar/item-preview-dialog"
import { MonthView } from "@/components/calendar/month-view"
import { TimeGrid, type MoveTarget } from "@/components/calendar/time-grid"
import { useScopePrompt } from "@/components/calendar/scope-dialog"
import {
  DEFAULT_FILTERS,
  buildBlockItems,
  buildDayItems,
  type CalendarFilters,
  type CalendarItem,
  type RecurringTaskTemplate,
} from "@/components/calendar/items"
import { useTasks, type Task } from "@/hooks/use-tasks"
import { useCategories } from "@/hooks/use-categories"
import { useBlocksRange } from "@/hooks/use-schedule-blocks"
import {
  useCalendarEventActions,
  useCalendarEvents,
  useCalendarWorkspace,
  useRevalidateTasks,
  type CalendarEventInput,
  type EditScope,
} from "@/hooks/use-calendar-events"
import { addDaysToDay, diffDays, isValidDay, minutesToTime, type EventOccurrence } from "@/lib/calendar"
import { stopTimerForTask } from "@/lib/timer-actions"
import { cn } from "@/lib/utils"

type View = "day" | "week" | "month"

const VIEW_LABELS: Record<View, string> = { day: "Dzień", week: "Tydzień", month: "Miesiąc" }
const VIEW_STORAGE_KEY = "zadaniomat-calendar-view"
const FILTERS_STORAGE_KEY = "zadaniomat-calendar-filters"

const toDay = (date: Date) => format(date, "yyyy-MM-dd")
const fromDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function daysForView(view: View, cursor: string): string[] {
  const date = fromDay(cursor)
  let start: Date
  let end: Date
  if (view === "day") {
    start = end = date
  } else if (view === "week") {
    start = startOfWeek(date, { weekStartsOn: 1 })
    end = endOfWeek(date, { weekStartsOn: 1 })
  } else {
    start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 })
    end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 })
  }
  const days: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(toDay(d))
  return days
}

function shiftCursor(view: View, cursor: string, direction: 1 | -1): string {
  const date = fromDay(cursor)
  if (view === "day") return toDay(addDays(date, direction))
  if (view === "week") return toDay(addDays(date, 7 * direction))
  return toDay(addMonths(startOfMonth(date), direction))
}

function titleFor(view: View, days: string[], cursor: string): string {
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
  if (view === "month") return capitalize(format(fromDay(cursor), "LLLL yyyy", { locale: pl }))
  if (view === "day") return capitalize(format(fromDay(cursor), "EEEE, d MMMM yyyy", { locale: pl }))
  const first = fromDay(days[0])
  const last = fromDay(days[days.length - 1])
  if (first.getMonth() === last.getMonth()) {
    return `${format(first, "d")} – ${format(last, "d MMMM yyyy", { locale: pl })}`
  }
  return `${format(first, "d MMM", { locale: pl })} – ${format(last, "d MMM yyyy", { locale: pl })}`
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

// 1 zadanie, 2 zadania, 5 zadań
function pluralTasks(n: number) {
  const lastTwo = n % 100
  const last = n % 10
  if (n === 1) return "1 zadanie"
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} zadania`
  return `${n} zadań`
}

function formatPlanned(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`
}

function FiltersPanel({ filters, onChange }: { filters: CalendarFilters; onChange: (filters: CalendarFilters) => void }) {
  const options: { key: keyof CalendarFilters; label: string; color: string; indent?: boolean; disabled?: boolean }[] = [
    { key: "events", label: "Wydarzenia", color: "#039be5" },
    { key: "tasks", label: "Zadania", color: "#64748b" },
    { key: "completed", label: "Ukończone zadania", color: "#16a34a", indent: true, disabled: !filters.tasks },
    { key: "recurring", label: "Zadania cykliczne (plan)", color: "#94a3b8", indent: true, disabled: !filters.tasks },
    { key: "blocks", label: "Bloki czasowe", color: "#6366f1" },
  ]
  return (
    <div className="space-y-1">
      {options.map((option) => (
        <label
          key={option.key}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
            option.indent && "pl-7",
            option.disabled && "pointer-events-none opacity-50"
          )}
        >
          <Checkbox
            checked={filters[option.key]}
            onCheckedChange={(checked) => onChange({ ...filters, [option.key]: checked === true })}
            className="border-0 data-[state=checked]:text-white"
            style={{ backgroundColor: filters[option.key] ? option.color : undefined, boxShadow: `inset 0 0 0 2px ${option.color}` }}
          />
          {option.label}
        </label>
      ))}
      <p className="px-2 pt-1 text-xs text-muted-foreground">Bloki czasowe widać w widoku dnia i tygodnia.</p>
    </div>
  )
}

export default function CalendarPage() {
  const [today, setToday] = useState(() => toDay(new Date()))
  const [view, setView] = useState<View>("month")
  const [cursor, setCursor] = useState(today)
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS)
  const [ready, setReady] = useState(false)

  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [editing, setEditing] = useState<EventOccurrence | null>(null)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // The small calendar can be browsed without moving the main view
  const [miniMonth, setMiniMonth] = useState(() => fromDay(today))
  useEffect(() => setMiniMonth(fromDay(cursor)), [cursor])

  const workspace = useCalendarWorkspace()
  const { categories } = useCategories()
  const { updateEvent, deleteEvent } = useCalendarEventActions()
  const revalidateTasks = useRevalidateTasks()
  const { askScope, confirmDelete, element: scopePrompt } = useScopePrompt()

  // View and filters from the last visit; ?date= and ?view= from links win
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const savedView = readStorage<{ view?: View }>(VIEW_STORAGE_KEY, {}).view
    const urlView = params.get("view") as View | null
    const initialView =
      urlView && urlView in VIEW_LABELS ? urlView : savedView ?? (window.innerWidth < 640 ? "day" : "month")
    setView(initialView)
    const urlDate = params.get("date")
    if (isValidDay(urlDate)) setCursor(urlDate)
    setFilters(readStorage(FILTERS_STORAGE_KEY, DEFAULT_FILTERS))
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ view }))
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // Storage can be unavailable (private mode) - the defaults are fine
    }
  }, [view, filters, ready])

  useEffect(() => {
    const timer = setInterval(() => setToday(toDay(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])

  const days = useMemo(() => daysForView(view, cursor), [view, cursor])
  const range = useMemo(() => ({ from: days[0], to: days[days.length - 1] }), [days])
  const month = cursor.slice(0, 7)

  const { occurrences, isLoading: eventsLoading } = useCalendarEvents(ready ? range : null)
  const { tasks, isLoading: tasksLoading, mutate: mutateTasks } = useTasks(range)
  const { data: templates } = useSWR<RecurringTaskTemplate[]>(`/api/recurring?workspace=${workspace}`)
  const { blocksForDay } = useBlocksRange(view === "month" ? null : range, filters.blocks)

  const items = useMemo(
    () =>
      buildDayItems({
        days,
        today,
        occurrences,
        tasks,
        templates: Array.isArray(templates) ? templates : [],
        filters,
      }),
    [days, today, occurrences, tasks, templates, filters]
  )
  const blockItems = useMemo(
    () => (filters.blocks && view !== "month" ? buildBlockItems(days, blocksForDay) : new Map()),
    [filters.blocks, view, days, blocksForDay]
  )

  const summary = useMemo(() => {
    const inRange = new Set(view === "month" ? days.filter((d) => d.startsWith(month)) : days)
    const rangeTasks = tasks.filter(
      (t) => t.scheduledDate && t.status !== "CANCELLED" && inRange.has(t.scheduledDate.slice(0, 10))
    )
    return {
      count: rangeTasks.length,
      done: rangeTasks.filter((t) => t.status === "COMPLETED").length,
      planned: rangeTasks.reduce((sum, t) => sum + (t.plannedMinutes || 0), 0),
    }
  }, [tasks, days, view, month])

  // ---------- actions ----------

  const openCreate = useCallback(
    (day?: string, allDay = false) => {
      const date = day ?? cursor
      const hour = Math.min(new Date().getHours() + 1, 23)
      const start = date === today ? hour * 60 : 9 * 60
      setDraft({
        date,
        allDay,
        startTime: minutesToTime(start),
        endTime: minutesToTime(start + 60),
      })
    },
    [cursor, today]
  )

  const goToDay = (day: string) => {
    setCursor(day)
    setView("day")
  }

  const moveEvent = async (item: Extract<CalendarItem, { kind: "event" }>, target: MoveTarget) => {
    const { event, date, endDate } = item.occurrence
    const span = diffDays(endDate, date)
    // Dragging a multi-day event by one of its later days moves it by the same number of days
    const newDate = addDaysToDay(date, diffDays(target.day, item.day))
    const input: CalendarEventInput = target.allDay
      ? { date: newDate, endDate: span ? addDaysToDay(newDate, span) : null, allDay: true, startTime: null, endTime: null }
      : { date: newDate, endDate: null, allDay: false, startTime: minutesToTime(target.start), endTime: minutesToTime(target.end) }

    let options: { scope?: EditScope; occurrenceDate?: string } = {}
    if (event.recurrenceRule) {
      const scope = await askScope("edit")
      if (!scope) return
      options = { scope, occurrenceDate: date }
    }
    try {
      await updateEvent(event, input, options)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się przenieść wydarzenia")
    }
  }

  const moveTask = async (task: Task, target: MoveTarget) => {
    const updates: Partial<Task> = {
      scheduledDate: target.day,
      scheduledTime: target.allDay ? null : minutesToTime(target.start),
    }
    if (!target.allDay && target.end - target.start !== (task.plannedMinutes || 30)) {
      updates.plannedMinutes = target.end - target.start
    }
    await mutateTasks((current) => current?.map((t) => (t.id === task.id ? { ...t, ...updates } : t)), { revalidate: false })
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error("Nie udało się przenieść zadania")
    } finally {
      revalidateTasks()
    }
  }

  const handleItemMove = (item: CalendarItem, target: MoveTarget) => {
    if (item.kind === "event") void moveEvent(item, target)
    else if (item.kind === "task") void moveTask(item.task, target)
  }

  const handleDeleteEvent = async (item: Extract<CalendarItem, { kind: "event" }>) => {
    const { event, date } = item.occurrence
    let options: { scope?: EditScope; date?: string } = {}
    if (event.recurrenceRule) {
      const scope = await askScope("delete")
      if (!scope) return
      options = { scope, date }
    } else if (!(await confirmDelete(event.title))) {
      return
    }
    setPreview(null)
    try {
      await deleteEvent(event, options)
      toast.success("Usunięto wydarzenie")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się usunąć")
    }
  }

  const handleToggleTask = async (task: Task) => {
    const status = task.status === "COMPLETED" ? "NEW" : "COMPLETED"
    setPreview(null)
    if (status === "COMPLETED") stopTimerForTask(task.id, { complete: true })
    await mutateTasks((current) => current?.map((t) => (t.id === task.id ? { ...t, status } : t)), { revalidate: false })
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      if (status === "COMPLETED") toast.success("Zadanie zrobione")
    } catch {
      toast.error("Nie udało się zmienić statusu")
    } finally {
      revalidateTasks()
    }
  }

  const handleSaveTask = async (taskId: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      toast.error("Nie udało się zapisać zadania")
      throw new Error("Failed to save task")
    }
    revalidateTasks()
  }

  // ---------- keyboard shortcuts (like Google Calendar) ----------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']")) return
      if (document.querySelector("[role='dialog']")) return

      switch (e.key.toLowerCase()) {
        case "t":
          setCursor(today)
          break
        case "d":
          setView("day")
          break
        case "w":
          setView("week")
          break
        case "m":
          setView("month")
          break
        case "j":
        case "n":
          setCursor((c) => shiftCursor(view, c, 1))
          break
        case "k":
        case "p":
          setCursor((c) => shiftCursor(view, c, -1))
          break
        case "c":
          openCreate()
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [view, today, openCreate])

  const isLoading = (eventsLoading || tasksLoading) && ready

  return (
    <div className="flex h-[calc(100dvh-8.75rem)] min-h-[520px] flex-col gap-3 animate-fade-in md:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setCursor(today)} title="Dziś (T)">
          Dziś
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => setCursor((c) => shiftCursor(view, c, -1))} title="Wstecz (K)">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCursor((c) => shiftCursor(view, c, 1))} title="Dalej (J)">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <h1 className="min-w-0 truncate text-lg font-semibold md:text-2xl">{titleFor(view, days, cursor)}</h1>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground lg:inline">
            {pluralTasks(summary.count)} · ukończone {summary.done} · plan {formatPlanned(summary.planned)}
          </span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="xl:hidden" title="Co pokazywać">
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <FiltersPanel filters={filters} onChange={setFilters} />
            </PopoverContent>
          </Popover>

          <div className="inline-flex rounded-md border p-0.5">
            {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded px-2.5 py-1.5 text-sm font-medium transition-colors md:px-3",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
                title={`${VIEW_LABELS[v]} (${v === "day" ? "D" : v === "week" ? "W" : "M"})`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          <Button onClick={() => openCreate()} className="xl:hidden" title="Utwórz (C)">
            <Plus className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Utwórz</span>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Side panel */}
        <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto xl:flex [&>*]:shrink-0">
          <Button onClick={() => openCreate()} size="lg" className="w-fit rounded-2xl px-5 shadow-md">
            <Plus className="mr-2 h-5 w-5" />
            Utwórz
          </Button>

          <div className="rounded-lg border">
            <MiniCalendar
              mode="single"
              selected={fromDay(cursor)}
              month={miniMonth}
              onMonthChange={setMiniMonth}
              onSelect={(date) => date && setCursor(toDay(date))}
              className="p-2"
              classNames={{
                head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.7rem]",
                cell: "h-8 w-8 text-center text-xs p-0 relative",
                day: "h-8 w-8 p-0 font-normal rounded-full hover:bg-muted aria-selected:opacity-100",
                day_selected: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200 font-semibold",
                day_today: "bg-blue-600 text-white hover:bg-blue-600",
              }}
            />
          </div>

          <div>
            <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pokaż</div>
            <FiltersPanel filters={filters} onChange={setFilters} />
          </div>

          <div className="space-y-1 text-sm">
            <Link href={`/schedule?date=${cursor}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Harmonogram dnia
            </Link>
            <Link href="/recurring" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <Repeat2 className="h-4 w-4 text-muted-foreground" />
              Zadania cykliczne
            </Link>
            <Link href="/settings/weekly-schedule" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              Szablon bloków tygodnia
            </Link>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <Keyboard className="h-3.5 w-3.5" />
              Skróty
            </div>
            <p>C – utwórz · T – dziś</p>
            <p>D / W / M – dzień, tydzień, miesiąc</p>
            <p>J / K – dalej, wstecz</p>
            <p className="mt-1">Przeciągnij po siatce godzin, żeby zaznaczyć czas nowego wydarzenia.</p>
          </div>
        </aside>

        {/* Calendar */}
        <div className="min-h-0 min-w-0 flex-1">
          {view === "month" ? (
            <MonthView
              days={days}
              month={month}
              today={today}
              items={items}
              onCreate={(day) => openCreate(day, true)}
              onItemClick={(item) => setPreview({ type: "item", item })}
              onItemMove={handleItemMove}
              onDayClick={goToDay}
            />
          ) : (
            <TimeGrid
              days={days}
              today={today}
              items={items}
              blocks={blockItems}
              onCreate={(day, start, end) =>
                start === null || end === null
                  ? openCreate(day, true)
                  : setDraft({ date: day, allDay: false, startTime: minutesToTime(start), endTime: minutesToTime(end) })
              }
              onItemClick={(item) => setPreview({ type: "item", item })}
              onItemMove={handleItemMove}
              onBlockClick={(block) => setPreview({ type: "block", block })}
              onDayClick={goToDay}
            />
          )}
        </div>
      </div>

      <EventDialog
        open={!!draft || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null)
            setEditing(null)
          }
        }}
        draft={draft}
        occurrence={editing}
        categories={categories}
      />

      <ItemPreviewDialog
        target={preview}
        onClose={() => setPreview(null)}
        onEditEvent={(item) => {
          setPreview(null)
          setEditing(item.occurrence)
        }}
        onDeleteEvent={handleDeleteEvent}
        onEditTask={(task) => {
          setPreview(null)
          setEditingTask(task)
        }}
        onToggleTask={handleToggleTask}
      />

      <TaskEditDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        categories={categories}
        onSave={handleSaveTask}
        onSubtasksChange={() => revalidateTasks()}
      />

      {scopePrompt}
    </div>
  )
}
