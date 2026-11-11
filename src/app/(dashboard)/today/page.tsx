"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import {
  Briefcase,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
  Plus,
  Repeat,
  Settings2,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { usePlanViewStore } from "@/stores/plan-view-store"
import { useHabits, completionOn, sortHabitsForDay, type DayChange, type Habit, type HabitInput } from "@/hooks/use-habits"
import { useSportActivities, useSportTypes, useSteps, weekRange } from "@/hooks/use-sport"
import { useChallenges, type Challenge } from "@/hooks/use-challenges"
import { useTasks, type Task } from "@/hooks/use-tasks"
import { useDayBlocks, type BlockData } from "@/hooks/use-schedule-blocks"
import { stopTimerForTask } from "@/lib/timer-actions"
import { addDaysKey, dateOfKey, dayKeyOf, formatStreak, todayKey } from "@/lib/tracking"
import { HabitRow } from "@/components/private/habit-row"
import { HabitDayDialog } from "@/components/private/habit-day-dialog"
import { HabitFormDialog, HABIT_IDEAS } from "@/components/private/habit-form-dialog"
import { SportQuickLog } from "@/components/private/sport-quick-log"
import { ActivityDialog, type ActivityDialogTarget, type ActivityFormValues } from "@/components/private/activity-dialog"
import { ChallengeCard } from "@/components/private/challenge-card"
import { PrivacyBanner } from "@/components/private/privacy-banner"

// ---------- habits ----------

const HabitsSection = memo(function HabitsSection({ day, isToday }: { day: string; isToday: boolean }) {
  const { from, to } = weekRange(day)
  const { habits, isLoading, setDay, createHabit, updateHabit, removeHabit } = useHabits({ from, to })

  const [details, setDetails] = useState<{ habit: Habit; day: string } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [idea, setIdea] = useState<(typeof HABIT_IDEAS)[number] | null>(null)

  const sorted = useMemo(() => sortHabitsForDay(habits), [habits])
  const doneCount = sorted.filter((habit) => completionOn(habit, day)).length
  const best = useMemo(
    () => habits.reduce<Habit | null>((top, h) => (h.currentStreak > (top?.currentStreak ?? 0) ? h : top), null),
    [habits]
  )

  // A habit counted in its own unit asks "how much" - a plain one is just ticked
  const handleToggle = useCallback(
    (habit: Habit, habitDay: string) => {
      if (habit.unit) setDetails({ habit, day: habitDay })
      else setDay(habit.id, habitDay)
    },
    [setDay]
  )
  const handleDetails = useCallback((habit: Habit, habitDay: string) => setDetails({ habit, day: habitDay }), [])
  const handleSaveDay = useCallback(
    (habitId: string, habitDay: string, change: DayChange) => setDay(habitId, habitDay, change),
    [setDay]
  )

  const openNew = (start: (typeof HABIT_IDEAS)[number] | null = null) => {
    setEditing(null)
    setIdea(start)
    setFormOpen(true)
  }

  const handleSubmit = async (input: HabitInput) => {
    try {
      if (editing) await updateHabit(editing.id, input)
      else await createHabit(input)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać nawyku")
      throw error
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4 text-private" />
          Nawyki
          {sorted.length > 0 && (
            <span className="text-sm font-normal tabular-nums text-muted-foreground">
              {doneCount}/{sorted.length}
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-10 gap-1 px-3 text-muted-foreground" onClick={() => openNew()}>
          <Plus className="h-4 w-4" />
          Dodaj
        </Button>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {sorted.length > 0 && (
          <div className="mx-2 mb-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-private transition-[width] duration-300"
              style={{ width: `${(doneCount / sorted.length) * 100}%` }}
            />
          </div>
        )}

        {isLoading && habits.length === 0 ? (
          <div className="space-y-2 px-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-2 py-2">
            <p className="mb-3 text-sm text-muted-foreground">
              Dodaj rzeczy, które chcesz robić regularnie. Odhaczasz je tutaj jednym dotknięciem.
            </p>
            <div className="flex flex-wrap gap-2">
              {HABIT_IDEAS.map((start) => (
                <button
                  key={start.name}
                  type="button"
                  onClick={() => openNew(start)}
                  className="flex h-11 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm transition-colors active:bg-accent md:hover:bg-accent/60"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  {start.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {sorted.map((habit) => (
              <div key={habit.id} className="group relative">
                <HabitRow habit={habit} day={day} isToday={isToday} onToggle={handleToggle} onDetails={handleDetails} />
              </div>
            ))}
          </div>
        )}

        {best && best.currentStreak > 1 && (
          <p className="mx-2 mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            Najdłuższa trwająca seria: {best.name} - {formatStreak(best.currentStreak, best.frequency)}
          </p>
        )}
      </CardContent>

      <HabitDayDialog
        target={details}
        onClose={() => setDetails(null)}
        onSave={handleSaveDay}
        onSettings={(habit) => {
          setDetails(null)
          setEditing(habit)
          setIdea(null)
          setFormOpen(true)
        }}
      />
      <HabitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        habit={editing}
        idea={idea}
        onSubmit={handleSubmit}
        onArchive={editing ? () => updateHabit(editing.id, { isActive: false }) : undefined}
        onDelete={
          editing
            ? () => {
                if (confirm(`Usunąć nawyk "${editing.name}" razem z całą historią?`)) removeHabit(editing.id)
              }
            : undefined
        }
      />
    </Card>
  )
})

// ---------- sport ----------

const SportSection = memo(function SportSection({ day }: { day: string }) {
  const range = weekRange(day)
  const { types, createType } = useSportTypes()
  const { activities, addActivity, updateActivity, removeActivity } = useSportActivities(range)
  const { steps, saveSteps } = useSteps(range)
  const [dialog, setDialog] = useState<ActivityDialogTarget | null>(null)

  const dayActivities = useMemo(() => activities.filter((a) => dayKeyOf(a.date) === day), [activities, day])
  const weekCount = useMemo(() => activities.filter((a) => !a.fromSteps).length, [activities])
  const daySteps = steps.find((s) => dayKeyOf(s.date) === day)

  const [stepsValue, setStepsValue] = useState("")
  useEffect(() => {
    setStepsValue(daySteps ? daySteps.count.toString() : "")
  }, [daySteps?.count, day]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitSteps = () => {
    const count = parseInt(stepsValue.replace(/\s/g, ""))
    if (!Number.isFinite(count) || count < 0 || count === daySteps?.count) return
    saveSteps(day, count)
  }

  const handleSave = useCallback(
    (values: ActivityFormValues, activityId?: string) => {
      if (activityId) updateActivity(activityId, values)
      else addActivity(values)
    },
    [addActivity, updateActivity]
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="h-4 w-4 text-private" />
          Sport
          <span className="text-sm font-normal text-muted-foreground">{weekCount} w tym tyg.</span>
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-10 px-3 text-muted-foreground">
          <Link href="/sport" prefetch={false}>
            Tydzień
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <SportQuickLog
          day={day}
          types={types}
          activities={dayActivities}
          onAdd={addActivity}
          onOpen={setDialog}
          onCreateType={createType}
        />
        <label className="flex items-center gap-3 rounded-lg border px-3 py-1.5">
          <Footprints className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="text-sm">Kroki</span>
          <Input
            type="text"
            inputMode="numeric"
            value={stepsValue}
            onChange={(e) => setStepsValue(e.target.value)}
            onBlur={commitSteps}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            }}
            placeholder="wpisz"
            className="h-10 flex-1 border-0 bg-transparent px-0 text-right text-base tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </label>
      </CardContent>
      <ActivityDialog
        target={dialog}
        types={types}
        onClose={() => setDialog(null)}
        onSave={handleSave}
        onDelete={removeActivity}
      />
    </Card>
  )
})

// ---------- challenges ----------

const ChallengesSection = memo(function ChallengesSection({ today }: { today: string }) {
  const { challenges, isLoading, addEntry, toggleDay } = useChallenges()
  // Running ones first; the ones not started yet don't belong to today
  const running = useMemo(
    () => challenges.filter((c) => dayKeyOf(c.startDate) <= today),
    [challenges, today]
  )
  const handleToggleDay = useCallback((challenge: Challenge, day: string) => toggleDay(challenge, day), [toggleDay])
  const handleAddEntry = useCallback((id: string, value: number) => addEntry(id, value, today), [addEntry, today])

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Trophy className="h-4 w-4 text-private" />
          Wyzwania
        </h2>
        <Button asChild variant="ghost" size="sm" className="h-10 px-3 text-muted-foreground">
          <Link href="/challenges" prefetch={false}>
            {running.length === 0 ? "Dodaj" : "Wszystkie"}
          </Link>
        </Button>
      </div>
      {isLoading && challenges.length === 0 ? (
        <Skeleton className="h-28 w-full" />
      ) : running.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Brak aktywnych wyzwań. Ustaw cel z terminem - np. 20 treningów w miesiącu albo odłożenie kwoty - a
            zobaczysz tutaj, czy idziesz zgodnie z planem.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {running.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              today={today}
              compact
              onAddEntry={handleAddEntry}
              onToggleDay={handleToggleDay}
            />
          ))}
        </div>
      )}
    </section>
  )
})

// ---------- plan of the day ----------

interface PlanItem {
  key: string
  time: string | null
  endTime?: string | null
  title: string
  color?: string | null
  kind: "block" | "task"
  work: boolean
  task?: Task
}

function planItems(tasks: Task[], blocks: BlockData[], work: boolean): PlanItem[] {
  return [
    ...blocks.map((block, i) => ({
      key: `${work ? "w" : "p"}-block-${i}-${block.startTime}`,
      time: block.startTime,
      endTime: block.endTime,
      title: block.name,
      color: block.color,
      kind: "block" as const,
      work,
    })),
    ...tasks
      .filter((task) => task.status !== "CANCELLED")
      .map((task) => ({
        key: `${work ? "w" : "p"}-task-${task.id}`,
        time: task.scheduledTime ?? null,
        title: task.title,
        color: task.category?.color,
        kind: "task" as const,
        work,
        task,
      })),
  ]
}

const PlanSection = memo(function PlanSection({ day, dayLabel }: { day: string; dayLabel: string }) {
  const { tasks, isLoading, optimisticUpdate, optimisticAdd } = useTasks({ date: day })
  const { blocks } = useDayBlocks(day)
  const showWork = usePlanViewStore((s) => s.showOtherWorkspace)
  const setShowWork = usePlanViewStore((s) => s.setShowOtherWorkspace)
  // Work is read only when asked for - and only shown, never changed from here
  const { data: workTasks } = useSWR<Task[]>(
    showWork ? `/api/tasks?workspace=WORK&date=${day}&includeAssigned=true` : null
  )
  const { data: workBlocks } = useSWR<{ blocks: BlockData[] }>(
    showWork ? `/api/schedule-blocks?workspace=WORK&date=${day}` : null
  )
  const [title, setTitle] = useState("")

  const items = useMemo(() => {
    const all = [
      ...planItems(tasks, blocks, false),
      ...(showWork ? planItems(workTasks ?? [], workBlocks?.blocks ?? [], true) : []),
    ]
    // With an hour first, in the order of the day; the rest after
    return all.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time) return -1
      if (b.time) return 1
      return 0
    })
  }, [tasks, blocks, showWork, workTasks, workBlocks])

  const hasTimes = items.some((item) => item.time)

  const toggleTask = (task: Task) => {
    // Just added - it can be ticked once it is saved
    if (task.id.startsWith("temp-")) return
    const status = task.status === "COMPLETED" ? "NEW" : "COMPLETED"
    if (status === "COMPLETED") stopTimerForTask(task.id, { complete: true })
    optimisticUpdate(task.id, { status }, async () => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(status === "COMPLETED" && { completedAt: new Date().toISOString() }) }),
      })
      if (!res.ok) throw new Error("Failed to update task")
    }).catch(() => toast.error("Nie udało się zapisać zadania"))
  }

  const addTask = (e: React.FormEvent) => {
    e.preventDefault()
    const name = title.trim()
    if (!name) return
    setTitle("")
    optimisticAdd({ title: name, scheduledDate: day, status: "NEW", plannedMinutes: 25 }, async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name,
          plannedMinutes: 25,
          scheduledDate: day,
          orderInDay: tasks.length,
          workspaceType: "PRIVATE",
          status: "NEW",
          isRecurring: false,
          recurrenceRule: null,
        }),
      })
      if (!res.ok) throw new Error("Failed to create task")
      return res.json()
    }).catch(() => toast.error("Nie udało się dodać zadania"))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-private" />
          Plan dnia
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-10 px-3 text-muted-foreground">
          <Link href={`/schedule?date=${day}`} prefetch={false}>
            Harmonogram
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 px-2 pb-3">
        <label className="mx-2 flex min-h-[2.75rem] items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Pokaż też pracę
          </span>
          <Switch checked={showWork} onCheckedChange={setShowWork} />
        </label>

        {isLoading && tasks.length === 0 ? (
          <div className="space-y-2 px-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">Nic zaplanowanego na {dayLabel}.</p>
        ) : (
          <ul>
            {items.map((item) => {
              const done = item.task?.status === "COMPLETED"
              const content = (
                <>
                  {/* The hour column only when something has an hour */}
                  {hasTimes && (
                    <span className="w-11 flex-shrink-0 text-xs tabular-nums text-muted-foreground">{item.time ?? ""}</span>
                  )}
                  {item.kind === "task" ? (
                    <span
                      className={cn(
                        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2",
                        done ? "border-transparent bg-private text-private-foreground" : "border-muted-foreground/40",
                        item.work && done && "bg-muted-foreground/50"
                      )}
                    >
                      {done && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                  ) : (
                    <span className="h-6 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color ?? "#6366f1" }} />
                  )}
                  <span className={cn("min-w-0 flex-1 truncate text-sm", done && "text-muted-foreground line-through")}>
                    {item.title}
                    {item.kind === "block" && item.endTime && (
                      <span className="text-xs text-muted-foreground"> · do {item.endTime}</span>
                    )}
                  </span>
                  {item.work && <Briefcase className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-label="Praca" />}
                </>
              )
              const rowClass = cn("flex min-h-[2.75rem] w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left", item.work && "opacity-60")
              return (
                <li key={item.key}>
                  {item.kind === "task" && !item.work && item.task ? (
                    <button
                      type="button"
                      onClick={() => toggleTask(item.task as Task)}
                      aria-pressed={done}
                      className={cn(rowClass, "transition-colors active:bg-accent md:hover:bg-accent/60")}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <form onSubmit={addTask} className="flex gap-2 px-2 pt-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Dodaj zadanie na ${dayLabel}`}
            className="h-11 text-base"
          />
          <Button type="submit" size="icon" className="h-11 w-11 flex-shrink-0" disabled={!title.trim()} aria-label="Dodaj zadanie">
            <Plus className="h-5 w-5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
})

// ---------- page ----------

export default function TodayPage() {
  const { workspace, setWorkspace } = useWorkspaceStore()
  const today = todayKey()
  const [day, setSelectedDay] = useState(today)
  const isToday = day === today

  // Left open overnight - the page moves on to the new day
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setSelectedDay((current) => (current === today ? todayKey() : current))
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [today])

  if (workspace !== "PRIVATE") {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-medium">Ekran „Dziś” należy do zakładki Prywatne</p>
          <p className="text-sm text-muted-foreground">Nawyki, sport, wyzwania i plan dnia w jednym miejscu.</p>
          <Button variant="private" className="h-11" onClick={() => setWorkspace("PRIVATE")}>
            Przejdź do Prywatne
          </Button>
        </CardContent>
      </Card>
    )
  }

  const date = dateOfKey(day)
  const dayLabel = isToday ? "dziś" : format(date, "EEEE", { locale: pl })

  return (
    <div className="mx-auto max-w-5xl space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold md:text-3xl">
            {isToday ? "Dziś" : day === addDaysKey(today, -1) ? "Wczoraj" : format(date, "EEEE", { locale: pl })}
          </h1>
          <p className="text-sm text-muted-foreground">{format(date, "EEEE, d MMMM", { locale: pl })}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {!isToday && (
            <Button variant="outline" className="h-11 px-3" onClick={() => setSelectedDay(today)}>
              Dziś
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setSelectedDay((d) => addDaysKey(d, -1))}
            aria-label="Poprzedni dzień"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            // Nothing to tick ahead of time
            disabled={isToday}
            onClick={() => setSelectedDay((d) => addDaysKey(d, 1))}
            aria-label="Następny dzień"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden h-11 w-11 sm:inline-flex" aria-label="Nawyki - ustawienia">
            <Link href="/habits" prefetch={false}>
              <Settings2 className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      <PrivacyBanner />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <HabitsSection day={day} isToday={isToday} />
          <SportSection day={day} />
        </div>
        <div className="space-y-4">
          <PlanSection day={day} dayLabel={dayLabel} />
          <ChallengesSection today={today} />
        </div>
      </div>
    </div>
  )
}
