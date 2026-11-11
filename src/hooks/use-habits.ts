import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { jsonRequest, trackWrite } from '@/lib/pending-writes'
import { patchLists, refreshPrivate } from '@/lib/private-sync'
import { addDaysKey, dayKeyOf, periodRange, todayKey, weekStartKey, type HabitFrequency } from '@/lib/tracking'

export interface HabitCompletion {
  id: string
  date: string
  count: number
  minutes?: number | null
  notes?: string | null
}

export interface Habit {
  id: string
  name: string
  description?: string | null
  frequency: HabitFrequency
  /** Weekly / monthly: how many times in the period */
  targetCount: number
  defaultMinutes?: number | null
  /** What is counted besides the tick ("stron"); empty - tick and minutes only */
  unit?: string | null
  /** HH:mm - shown in the plan of the day */
  scheduledTime?: string | null
  color: string
  icon?: string | null
  /** Counted from the days really done: days / weeks / months in a row */
  currentStreak: number
  longestStreak: number
  /** Done in the running week / month (daily: today) and how many are needed */
  periodDone: number
  periodTarget: number
  isActive: boolean
  isPublic: boolean
  categoryId?: string | null
  completions: HabitCompletion[]
  category?: { id: string; name: string; color: string } | null
}

export interface HabitInput {
  name: string
  frequency: HabitFrequency
  targetCount: number
  defaultMinutes: number | null
  unit: string | null
  scheduledTime: string | null
  color: string
  categoryId: string | null
  isPublic: boolean
}

export interface DayChange {
  done?: boolean
  minutes?: number | null
  count?: number
  notes?: string | null
}

/** Key of the habits list with the completions of a range of days */
export function habitsKey(from: string, to: string, today: string = todayKey()) {
  return `/api/habits?from=${from}&to=${to}&today=${today}`
}

/** The week of a day - the range every page asks for, so they share one kept list */
export function habitsWeekKey(day: string = todayKey()) {
  const from = weekStartKey(day)
  return habitsKey(from, addDaysKey(from, 6))
}

export function completionOn(habit: Habit, day: string): HabitCompletion | undefined {
  return habit.completions.find((c) => dayKeyOf(c.date) === day)
}

/** Habits in the order of the day: the timed ones by their hour, then the rest */
export function sortHabitsForDay(habits: Habit[]): Habit[] {
  return [...habits].sort((a, b) => {
    if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime)
    if (a.scheduledTime) return -1
    if (b.scheduledTime) return 1
    return 0
  })
}

function applyDayChange(habit: Habit, day: string, change: DayChange, today: string): Habit {
  const existing = completionOn(habit, day)
  const hasDetails = change.minutes !== undefined || change.count !== undefined || change.notes !== undefined
  const wantsDone = change.done ?? (existing ? hasDetails : true)
  const period = periodRange(habit.frequency, today)
  const inPeriod = day >= period.from && day <= period.to

  if (!wantsDone) {
    if (!existing) return habit
    return {
      ...habit,
      completions: habit.completions.filter((c) => c !== existing),
      periodDone: inPeriod ? Math.max(0, habit.periodDone - 1) : habit.periodDone,
      // The exact streak comes with the answer; today's tick of a daily habit is the obvious part
      currentStreak:
        habit.frequency === 'DAILY' && day === today ? Math.max(0, habit.currentStreak - 1) : habit.currentStreak,
    }
  }

  if (existing) {
    const updated: HabitCompletion = {
      ...existing,
      ...(change.minutes !== undefined && { minutes: change.minutes }),
      ...(change.count !== undefined && { count: change.count }),
      ...(change.notes !== undefined && { notes: change.notes }),
    }
    return { ...habit, completions: habit.completions.map((c) => (c === existing ? updated : c)) }
  }

  const created: HabitCompletion = {
    id: `temp-${habit.id}-${day}`,
    date: `${day}T00:00:00.000Z`,
    count: change.count ?? 1,
    minutes: change.minutes !== undefined ? change.minutes : habit.defaultMinutes ?? null,
    notes: change.notes ?? null,
  }
  const currentStreak =
    habit.frequency === 'DAILY' && day === today ? habit.currentStreak + 1 : habit.currentStreak
  return {
    ...habit,
    completions: [created, ...habit.completions],
    periodDone: inPeriod ? habit.periodDone + 1 : habit.periodDone,
    currentStreak,
    longestStreak: Math.max(habit.longestStreak, currentStreak),
  }
}

/**
 * Habits with the completions of a range of days (default: this week).
 * A tick shows at once and is saved in the background.
 */
export function useHabits(range?: { from: string; to: string }) {
  const today = todayKey()
  const key = range ? habitsKey(range.from, range.to, today) : habitsWeekKey(today)

  const { data, error, isLoading, mutate } = useSWR<Habit[]>(key)

  /** Marks / unmarks a day or fills in its minutes, count, note */
  const setDay = useCallback(
    async (habitId: string, day: string, change: DayChange = {}) => {
      // The wanted state is sent, not "switch" - a repeated request can't undo the click
      let done = change.done
      await patchLists<Habit[]>('habits', (habits) =>
        habits.map((habit) => {
          if (habit.id !== habitId) return habit
          if (done === undefined) {
            const hasDetails = change.minutes !== undefined || change.count !== undefined || change.notes !== undefined
            done = completionOn(habit, day) ? hasDetails : true
          }
          return applyDayChange(habit, day, { ...change, done }, today)
        })
      )
      try {
        await trackWrite(() =>
          jsonRequest(`/api/habits/${habitId}/complete`, 'POST', { ...change, done: done ?? true, date: day, today })
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać')
      } finally {
        refreshPrivate('habits')
      }
    },
    [today]
  )

  const createHabit = useCallback(async (input: HabitInput) => {
    const habit = await jsonRequest<Habit>('/api/habits', 'POST', input)
    refreshPrivate('habits')
    return habit
  }, [])

  const updateHabit = useCallback(
    async (habitId: string, input: Partial<HabitInput> & { isActive?: boolean }) => {
      await patchLists<Habit[]>('habits', (habits) =>
        input.isActive === false
          ? habits.filter((h) => h.id !== habitId)
          : habits.map((h) => (h.id === habitId ? { ...h, ...input } : h))
      )
      try {
        await trackWrite(() => jsonRequest(`/api/habits/${habitId}`, 'PATCH', { ...input, today }))
      } finally {
        refreshPrivate('habits')
      }
    },
    [today]
  )

  const removeHabit = useCallback(async (habitId: string) => {
    await patchLists<Habit[]>('habits', (habits) => habits.filter((h) => h.id !== habitId))
    try {
      await trackWrite(() => jsonRequest(`/api/habits/${habitId}`, 'DELETE'))
    } finally {
      refreshPrivate('habits')
    }
  }, [])

  const habits = useMemo(() => data ?? [], [data])

  return {
    habits,
    isLoading,
    isError: error,
    mutate,
    setDay,
    createHabit,
    updateHabit,
    removeHabit,
  }
}
