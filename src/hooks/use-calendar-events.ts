import useSWR, { useSWRConfig } from "swr"
import { useCallback, useMemo } from "react"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { expandEvents, type CalendarEventData } from "@/lib/calendar"

export type EditScope = "this" | "following" | "all"

export type CalendarEventInput = Partial<
  Pick<
    CalendarEventData,
    | "title"
    | "description"
    | "date"
    | "endDate"
    | "allDay"
    | "startTime"
    | "endTime"
    | "color"
    | "recurrenceRule"
    | "recurrenceInterval"
    | "recurrenceDays"
    | "recurrenceEnd"
    | "categoryId"
  >
>

const EVENTS_KEY = "/api/calendar-events"

export function useCalendarWorkspace(): "WORK" | "PRIVATE" {
  const { workspace } = useWorkspaceStore()
  return workspace === "PRIVATE" ? "PRIVATE" : "WORK"
}

// Events for a range of days, with recurring events expanded into occurrences
export function useCalendarEvents(range: { from: string; to: string } | null) {
  const workspace = useCalendarWorkspace()
  const key = range ? `${EVENTS_KEY}?workspace=${workspace}&from=${range.from}&to=${range.to}` : null

  const { data, error, isLoading, mutate } = useSWR<CalendarEventData[]>(key, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })

  const from = range?.from
  const to = range?.to
  const occurrences = useMemo(
    () => (data && from && to ? expandEvents(data, from, to) : []),
    [data, from, to]
  )

  return { events: data ?? [], occurrences, isLoading, isError: error, mutate }
}

async function readError(res: Response, fallback: string) {
  try {
    const body = await res.json()
    return typeof body?.error === "string" ? body.error : fallback
  } catch {
    return fallback
  }
}

// Create / update / delete; every loaded range (calendar, schedule) is refreshed afterwards
export function useCalendarEventActions() {
  const { mutate } = useSWRConfig()
  const workspace = useCalendarWorkspace()

  const isEventsKey = (key: unknown) => typeof key === "string" && key.startsWith(EVENTS_KEY)
  const revalidate = useCallback(() => mutate(isEventsKey), [mutate])

  const createEvent = useCallback(
    async (input: CalendarEventInput) => {
      const res = await fetch(EVENTS_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, workspaceType: workspace }),
      })
      if (!res.ok) throw new Error(await readError(res, "Nie udało się dodać wydarzenia"))
      await revalidate()
      return (await res.json()) as CalendarEventData
    },
    [workspace, revalidate]
  )

  const updateEvent = useCallback(
    async (
      event: CalendarEventData,
      input: CalendarEventInput,
      options: { scope?: EditScope; occurrenceDate?: string } = {}
    ) => {
      // One-off events move right away; recurring ones wait for the server to split the series
      if (!event.recurrenceRule) {
        mutate(
          isEventsKey,
          (current?: CalendarEventData[]) =>
            current?.map((e) => (e.id === event.id ? { ...e, ...input } : e)),
          { revalidate: false }
        )
      }
      try {
        const res = await fetch(`${EVENTS_KEY}/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, ...options }),
        })
        if (!res.ok) throw new Error(await readError(res, "Nie udało się zapisać wydarzenia"))
      } finally {
        await revalidate()
      }
    },
    [mutate, revalidate]
  )

  const deleteEvent = useCallback(
    async (event: CalendarEventData, options: { scope?: EditScope; date?: string } = {}) => {
      const params = new URLSearchParams()
      if (options.scope) params.set("scope", options.scope)
      if (options.date) params.set("date", options.date)
      if (!event.recurrenceRule || options.scope === "all") {
        mutate(
          isEventsKey,
          (current?: CalendarEventData[]) => current?.filter((e) => e.id !== event.id),
          { revalidate: false }
        )
      }
      try {
        const res = await fetch(`${EVENTS_KEY}/${event.id}?${params.toString()}`, { method: "DELETE" })
        if (!res.ok) throw new Error(await readError(res, "Nie udało się usunąć wydarzenia"))
      } finally {
        await revalidate()
      }
    },
    [mutate, revalidate]
  )

  return { createEvent, updateEvent, deleteEvent, revalidate }
}

// Refresh every task list (calendar, schedule, counts) after a change made in the calendar
export function useRevalidateTasks() {
  const { mutate } = useSWRConfig()
  return useCallback(
    () => mutate((key) => typeof key === "string" && key.startsWith("/api/tasks")),
    [mutate]
  )
}
