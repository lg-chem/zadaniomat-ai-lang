import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { jsonRequest, trackWrite } from '@/lib/pending-writes'
import { patchLists, refreshPrivate } from '@/lib/private-sync'
import { addDaysKey, dayKeyOf, todayKey, weekStartKey } from '@/lib/tracking'

export interface SportActivityType {
  id: string
  name: string
  icon?: string | null
  color: string
  isDefault: boolean
  hasBodyParts: boolean
}

export interface SportActivity {
  id: string
  date: string
  duration?: number | null
  notes?: string | null
  fromSteps: boolean
  isPublic: boolean
  type: SportActivityType
  bodyParts: { id: string; name: string }[]
}

export interface StepsEntry {
  id: string
  date: string
  count: number
  notes?: string | null
  copiedToActivity: boolean
}

export interface ActivityInput {
  type: SportActivityType
  /** yyyy-MM-dd */
  day: string
  duration?: number | null
  notes?: string | null
  bodyParts?: string[]
  isPublic?: boolean
}

/** A range of days as yyyy-MM-dd keys */
export interface DayRange {
  from: string
  to: string
}

export const BODY_PARTS = ['Klata', 'Plecy', 'Barki', 'Biceps', 'Triceps', 'Pośladki', 'Nogi', 'Brzuch']

/** Monday - Sunday of a day's week: the range every page asks for, so they share one kept list */
export function weekRange(day: string = todayKey()): DayRange {
  const from = weekStartKey(day)
  return { from, to: addDaysKey(from, 6) }
}

export const sportActivitiesKey = (range: DayRange) => `/api/sport/activities?from=${range.from}&to=${range.to}`
export const stepsKey = (range: DayRange) => `/api/sport/steps?from=${range.from}&to=${range.to}`

const inRange = (day: string, range: DayRange) => day >= range.from && day <= range.to

export function useSportTypes() {
  const { data, error, isLoading, mutate } = useSWR<SportActivityType[]>('/api/sport/types')

  const createType = useCallback(
    async (name: string, hasBodyParts = false) => {
      const type = await jsonRequest<SportActivityType>('/api/sport/types', 'POST', { name, hasBodyParts })
      await mutate()
      return type
    },
    [mutate]
  )

  return {
    types: data ?? [],
    isLoading,
    isError: error,
    mutate,
    createType,
  }
}

/** Workouts of a range of days (default: this week). Adding and deleting show at once. */
export function useSportActivities(range: DayRange = weekRange()) {
  const key = sportActivitiesKey(range)
  const { data, error, isLoading, mutate } = useSWR<SportActivity[]>(key)

  const addActivity = useCallback(
    async (input: ActivityInput) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const temp: SportActivity = {
        id: tempId,
        date: `${input.day}T00:00:00.000Z`,
        duration: input.duration ?? null,
        notes: input.notes ?? null,
        fromSteps: false,
        isPublic: input.isPublic ?? false,
        type: input.type,
        bodyParts: (input.bodyParts ?? []).map((name) => ({ id: `${tempId}-${name}`, name })),
      }
      // Goes to every kept list - each hook shows only the days of its own range
      await patchLists<SportActivity[]>('sport', (list) => [...list, temp])
      try {
        const saved = await trackWrite(() =>
          jsonRequest<SportActivity>('/api/sport/activities', 'POST', {
            typeId: input.type.id,
            date: input.day,
            duration: input.duration ?? null,
            notes: input.notes ?? null,
            bodyParts: input.bodyParts ?? [],
            isPublic: input.isPublic ?? false,
          })
        )
        // The real id right away - the workout can be opened or deleted without waiting for the reload
        await patchLists<SportActivity[]>('sport', (list) => list.map((a) => (a.id === tempId ? saved : a)))
        return saved
      } catch (error) {
        await patchLists<SportActivity[]>('sport', (list) => list.filter((a) => a.id !== tempId))
        toast.error(error instanceof Error ? error.message : 'Nie udało się dodać aktywności')
        return null
      } finally {
        refreshPrivate('sport')
      }
    },
    []
  )

  const updateActivity = useCallback(
    async (
      id: string,
      changes: { type?: SportActivityType; day?: string; duration?: number | null; notes?: string | null; bodyParts?: string[]; isPublic?: boolean }
    ) => {
      await patchLists<SportActivity[]>('sport', (list) =>
        list.map((a) =>
          a.id !== id
            ? a
            : {
                ...a,
                ...(changes.type && { type: changes.type }),
                ...(changes.day && { date: `${changes.day}T00:00:00.000Z` }),
                ...(changes.duration !== undefined && { duration: changes.duration }),
                ...(changes.notes !== undefined && { notes: changes.notes }),
                ...(changes.isPublic !== undefined && { isPublic: changes.isPublic }),
                ...(changes.bodyParts && { bodyParts: changes.bodyParts.map((name) => ({ id: `${id}-${name}`, name })) }),
              }
        )
      )
      try {
        await trackWrite(() =>
          jsonRequest(`/api/sport/activities/${id}`, 'PATCH', {
            ...(changes.type && { typeId: changes.type.id }),
            ...(changes.day && { date: changes.day }),
            ...(changes.duration !== undefined && { duration: changes.duration }),
            ...(changes.notes !== undefined && { notes: changes.notes }),
            ...(changes.isPublic !== undefined && { isPublic: changes.isPublic }),
            ...(changes.bodyParts && { bodyParts: changes.bodyParts }),
          })
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać aktywności')
      } finally {
        refreshPrivate('sport')
      }
    },
    []
  )

  const removeActivity = useCallback(async (id: string) => {
    await patchLists<SportActivity[]>('sport', (list) => list.filter((a) => a.id !== id))
    try {
      await trackWrite(() => jsonRequest(`/api/sport/activities/${id}`, 'DELETE'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć aktywności')
    } finally {
      refreshPrivate('sport', 'steps')
    }
  }, [])

  const { from, to } = range
  const activities = useMemo(
    () => (data ?? []).filter((a) => inRange(dayKeyOf(a.date), { from, to })),
    [data, from, to]
  )

  return {
    activities,
    isLoading,
    isError: error,
    mutate,
    addActivity,
    updateActivity,
    removeActivity,
  }
}

/** Steps of a range of days (default: this week) */
export function useSteps(range: DayRange = weekRange()) {
  const { data, error, isLoading, mutate } = useSWR<StepsEntry[]>(stepsKey(range))

  const saveSteps = useCallback(async (day: string, count: number) => {
    await patchLists<StepsEntry[]>('steps', (list) => {
      const existing = list.find((s) => dayKeyOf(s.date) === day)
      if (existing) return list.map((s) => (s === existing ? { ...s, count } : s))
      // Goes to every kept list - each hook shows only the days of its own range
      return [...list, { id: `temp-${day}`, date: `${day}T00:00:00.000Z`, count, copiedToActivity: false }]
    })
    try {
      await trackWrite(() => jsonRequest('/api/sport/steps', 'POST', { date: day, count }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać kroków')
    } finally {
      refreshPrivate('steps')
    }
  }, [])

  const { from, to } = range
  const steps = useMemo(() => (data ?? []).filter((s) => inRange(dayKeyOf(s.date), { from, to })), [data, from, to])

  return {
    steps,
    isLoading,
    isError: error,
    mutate,
    saveSteps,
  }
}
