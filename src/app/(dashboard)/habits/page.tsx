"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { Check, ChevronLeft, ChevronRight, Clock, Flame, Plus, Settings2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useHabits, completionOn, type DayChange, type Habit, type HabitInput } from "@/hooks/use-habits"
import {
  addDaysKey,
  dateOfKey,
  dayKeyOf,
  formatMinutes,
  habitRhythmLabel,
  STREAK_UNIT,
  formatStreak,
  todayKey,
  weekStartKey,
} from "@/lib/tracking"
import { HabitDayDialog } from "@/components/private/habit-day-dialog"
import { HabitFormDialog, HABIT_IDEAS } from "@/components/private/habit-form-dialog"

interface HabitWeekRowProps {
  habit: Habit
  days: string[]
  today: string
  onTick: (habit: Habit, day: string) => void
  onDetails: (habit: Habit, day: string) => void
  onSettings: (habit: Habit) => void
}

/**
 * A habit over a week: seven thumb-sized days. An empty day is ticked with one tap;
 * a done day opens its details (minutes, count, note, untick) - a stray tap on a
 * small square can't wipe a day.
 */
const HabitWeekRow = memo(function HabitWeekRow({ habit, days, today, onTick, onDetails, onSettings }: HabitWeekRowProps) {
  const weekMinutes = days.reduce((sum, day) => sum + (completionOn(habit, day)?.minutes ?? 0), 0)
  const weekDone = days.filter((day) => completionOn(habit, day)).length

  return (
    <div className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{habit.name}</span>
            {habit.isPublic && <Users className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-label="Widoczny dla znajomych" />}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
            <span>{habitRhythmLabel(habit.frequency, habit.targetCount)}</span>
            {habit.frequency !== "DAILY" && (
              <span className={cn("tabular-nums", weekDone >= habit.targetCount && habit.frequency === "WEEKLY" && "text-green-600 dark:text-green-400")}>
                {habit.frequency === "WEEKLY" ? `${weekDone}/${habit.targetCount}` : `${habit.periodDone}/${habit.periodTarget} w mies.`}
              </span>
            )}
            {habit.currentStreak > 0 && (
              <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
                <Flame className="h-3.5 w-3.5" />
                {formatStreak(habit.currentStreak, habit.frequency)}
              </span>
            )}
            {habit.longestStreak > habit.currentStreak && (
              <span>
                rekord {formatStreak(habit.longestStreak, habit.frequency)}
              </span>
            )}
            {weekMinutes > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {formatMinutes(weekMinutes)}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 flex-shrink-0 text-muted-foreground md:order-last"
          onClick={() => onSettings(habit)}
          aria-label={`Ustawienia: ${habit.name}`}
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
        {days.map((day) => {
          const completion = completionOn(habit, day)
          const done = !!completion
          const future = day > today
          const date = dateOfKey(day)
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => (done || habit.unit ? onDetails(habit, day) : onTick(habit, day))}
              aria-pressed={done}
              aria-label={`${habit.name}, ${format(date, "EEEE d MMMM", { locale: pl })}`}
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-lg text-[11px] leading-tight transition-transform md:w-12",
                done ? "text-white" : "border border-dashed border-muted-foreground/30 text-muted-foreground",
                day === today && !done && "border-solid border-foreground/60 text-foreground",
                future ? "opacity-40" : "active:scale-95"
              )}
              style={done ? { backgroundColor: habit.color } : undefined}
            >
              {done ? (
                habit.unit ? (
                  <span className="text-sm font-semibold tabular-nums">{completion.count}</span>
                ) : (
                  <Check className="h-5 w-5" strokeWidth={3} />
                )
              ) : (
                <>
                  <span className="uppercase">{format(date, "EEEEEE", { locale: pl })}</span>
                  <span className="text-sm font-semibold tabular-nums">{format(date, "d")}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
})

export default function HabitsPage() {
  const today = todayKey()
  const [weekStart, setWeekStart] = useState(() => weekStartKey(today))
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i)), [weekStart])
  const isThisWeek = weekStart === weekStartKey(today)

  const { habits, isLoading, setDay, createHabit, updateHabit, removeHabit } = useHabits({
    from: weekStart,
    to: days[6],
  })

  const [details, setDetails] = useState<{ habit: Habit; day: string } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [idea, setIdea] = useState<(typeof HABIT_IDEAS)[number] | null>(null)

  const handleTick = useCallback((habit: Habit, day: string) => setDay(habit.id, day, { done: true }), [setDay])
  const handleDetails = useCallback((habit: Habit, day: string) => setDetails({ habit, day }), [])
  const handleSaveDay = useCallback((habitId: string, day: string, change: DayChange) => setDay(habitId, day, change), [setDay])
  const handleSettings = useCallback((habit: Habit) => {
    setDetails(null)
    setEditing(habit)
    setIdea(null)
    setFormOpen(true)
  }, [])

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

  // Week summary - only the days of the week being viewed
  const summary = useMemo(() => {
    const inWeek = (date: string) => {
      const day = dayKeyOf(date)
      return day >= weekStart && day <= days[6]
    }
    let done = 0
    let minutes = 0
    for (const habit of habits) {
      for (const completion of habit.completions) {
        if (!inWeek(completion.date)) continue
        done++
        minutes += completion.minutes ?? 0
      }
    }
    const best = habits.reduce<Habit | null>((top, h) => (h.currentStreak > (top?.currentStreak ?? 0) ? h : top), null)
    return { done, minutes, best }
  }, [habits, weekStart, days])

  return (
    <div className="mx-auto max-w-4xl space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Nawyki</h1>
          <p className="text-sm text-muted-foreground">Tydzień po tygodniu - odhaczaj i pilnuj serii</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setWeekStart((w) => addDaysKey(w, -7))} aria-label="Poprzedni tydzień">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 px-2 text-center text-sm font-medium sm:min-w-[11rem]">
            {format(dateOfKey(weekStart), "d MMM", { locale: pl })} – {format(dateOfKey(days[6]), "d MMM yyyy", { locale: pl })}
          </div>
          {!isThisWeek && (
            <Button variant="outline" className="h-11 px-3" onClick={() => setWeekStart(weekStartKey(today))}>
              Ten tydzień
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            disabled={isThisWeek}
            onClick={() => setWeekStart((w) => addDaysKey(w, 7))}
            aria-label="Następny tydzień"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {habits.length > 0 && (
        <Card>
          <CardContent className="grid grid-cols-3 gap-3 p-4">
            <div>
              <div className="text-xs text-muted-foreground">Wykonane w tygodniu</div>
              <div className="text-xl font-bold tabular-nums">{summary.done}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Czas w tygodniu</div>
              <div className="text-xl font-bold tabular-nums">{summary.minutes ? formatMinutes(summary.minutes) : "–"}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Najdłuższa seria</div>
              <div className="flex items-baseline gap-1 text-xl font-bold tabular-nums">
                {summary.best && summary.best.currentStreak > 0 ? (
                  <>
                    {summary.best.currentStreak}
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {STREAK_UNIT[summary.best.frequency]} · {summary.best.name}
                    </span>
                  </>
                ) : (
                  "–"
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading && habits.length === 0 ? (
            <div className="space-y-3 p-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : habits.length === 0 ? (
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                Nie masz jeszcze nawyków. Zacznij od jednego z gotowych albo dodaj własny - potem odhaczasz je
                jednym dotknięciem na ekranie Dziś.
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
            <div className="divide-y">
              {habits.map((habit) => (
                <HabitWeekRow
                  key={habit.id}
                  habit={habit}
                  days={days}
                  today={today}
                  onTick={handleTick}
                  onDetails={handleDetails}
                  onSettings={handleSettings}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button className="h-11 w-full sm:w-auto" onClick={() => openNew()}>
        <Plus className="mr-2 h-4 w-4" />
        Nowy nawyk
      </Button>

      <HabitDayDialog target={details} onClose={() => setDetails(null)} onSave={handleSaveDay} onSettings={handleSettings} />
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
    </div>
  )
}
