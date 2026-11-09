import { useCallback, useMemo } from "react"
import useSWR, { useSWRConfig } from "swr"
import { toast } from "sonner"
import { jsonRequest, refreshWhenIdle, trackWrite } from "@/lib/pending-writes"
import { isTasksKey, isTempTaskId, resolveTaskId, trackTaskCreate } from "@/lib/task-writes"
import type { GoalTaskItem } from "@/lib/quarters"

// Tasks of quarter goals and sprint commitments on the goals page.
// Every change shows at once and is saved in the background.

/** All tasks of a sprint's commitments - one request for the whole sprint panel */
export const sprintTasksKey = (sprintId: string) => `/api/sprints/${sprintId}/tasks`
/** Tasks of one goal */
export const goalTasksKey = (goalId: string) => `/api/goals/${goalId}/tasks`

export function useGoalTasks(key: string | null) {
  const { data, isLoading, mutate } = useSWR<GoalTaskItem[]>(key)
  const tasks = useMemo(() => (data ?? []).filter((t) => t.status !== "CANCELLED"), [data])
  return { tasks, isLoaded: data !== undefined, isLoading, mutate }
}

const taskUrl = async (id: string) => {
  const realId = await resolveTaskId(id)
  if (!realId) throw new Error("Zadanie nie zostało zapisane")
  return `/api/tasks/${realId}`
}

export interface GoalTaskActions {
  add: (goalId: string, title: string, dayKey: string | null) => void
  toggle: (task: GoalTaskItem) => void
  rename: (task: GoalTaskItem, title: string) => void
  schedule: (task: GoalTaskItem, dayKey: string | null) => void
  linkNote: (task: GoalTaskItem, note: GoalTaskItem["linkedNote"]) => void
  remove: (task: GoalTaskItem) => void
  /** Saves the task's note (description) - the editor shows it already */
  saveNote: (task: GoalTaskItem, html: string | null) => Promise<void>
  /** Only the screen - e.g. the checklist saves its own changes */
  setLocal: (taskId: string, change: Partial<GoalTaskItem>) => void
}

/**
 * @param key cache of the list the tasks are in (sprintTasksKey / goalTasksKey)
 * @param onCountsChanged reload of what shows the task counts (the quarter)
 */
export function useGoalTaskActions(key: string, onCountsChanged?: () => void): GoalTaskActions {
  const { mutate } = useSWRConfig()

  const apply = useCallback(
    (change: (tasks: GoalTaskItem[]) => GoalTaskItem[]) =>
      mutate<GoalTaskItem[]>(key, (current) => change(current ?? []), { revalidate: false }),
    [mutate, key]
  )

  const setLocal = useCallback(
    (taskId: string, change: Partial<GoalTaskItem>) =>
      apply((tasks) => tasks.map((t) => (t.id === taskId ? { ...t, ...change } : t))),
    [apply]
  )

  // Saves in the background. Harmonogram and Notatki lists are refreshed afterwards;
  // on an error the list is reloaded, which brings back what the server has.
  const save = useCallback(
    async (write: () => Promise<unknown>, errorMessage: string, opts: { counts?: boolean } = {}) => {
      try {
        await trackWrite(write)
      } catch (error) {
        console.error(errorMessage, error)
        toast.error(errorMessage)
        refreshWhenIdle(key, () => mutate(key))
      }
      refreshWhenIdle("task-lists", () => mutate(isTasksKey))
      if (opts.counts && onCountsChanged) refreshWhenIdle(`counts:${key}`, onCountsChanged)
    },
    [mutate, key, onCountsChanged]
  )

  return useMemo<GoalTaskActions>(
    () => ({
      add: (goalId, title, dayKey) => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        apply((tasks) => [
          ...tasks,
          {
            id: tempId,
            title,
            status: "NEW",
            description: null,
            scheduledDate: dayKey ? `${dayKey}T00:00:00.000Z` : null,
            scheduledTime: null,
            plannedMinutes: null,
            goalId,
            subtasks: [],
            linkedNote: null,
          },
        ])
        const created = jsonRequest<GoalTaskItem>(`/api/goals/${goalId}/tasks`, "POST", {
          title,
          scheduledDate: dayKey,
        })
        trackTaskCreate(tempId, created.then((task) => task.id))
        void save(
          async () => {
            const task = await created
            // Keep what was changed on the row meanwhile - only the id is new
            apply((tasks) => tasks.map((t) => (t.id === tempId ? { ...t, id: task.id } : t)))
          },
          "Nie udało się dodać zadania",
          { counts: true }
        )
      },

      toggle: (task) => {
        const status = task.status === "COMPLETED" ? "NEW" : "COMPLETED"
        setLocal(task.id, { status })
        void save(
          async () => jsonRequest(await taskUrl(task.id), "PATCH", { status }),
          "Nie udało się zapisać zadania",
          { counts: true }
        )
      },

      rename: (task, title) => {
        const value = title.trim()
        if (!value || value === task.title) return
        setLocal(task.id, { title: value })
        void save(async () => jsonRequest(await taskUrl(task.id), "PATCH", { title: value }), "Nie udało się zmienić nazwy")
      },

      schedule: (task, dayKey) => {
        setLocal(task.id, { scheduledDate: dayKey ? `${dayKey}T00:00:00.000Z` : null })
        void save(
          async () => jsonRequest(await taskUrl(task.id), "PATCH", { scheduledDate: dayKey }),
          "Nie udało się zaplanować zadania"
        )
      },

      linkNote: (task, note) => {
        setLocal(task.id, { linkedNote: note })
        void save(
          async () => jsonRequest(await taskUrl(task.id), "PATCH", { noteId: note?.id ?? null }),
          note ? "Nie udało się podpiąć notatki" : "Nie udało się odpiąć notatki"
        )
      },

      remove: (task) => {
        apply((tasks) => tasks.filter((t) => t.id !== task.id))
        void save(
          async () => jsonRequest(await taskUrl(task.id), "DELETE"),
          "Nie udało się usunąć zadania",
          { counts: true }
        )
      },

      saveNote: async (task, html) => {
        // Thrown errors are shown by the editor, which retries on the next change
        await trackWrite(async () => jsonRequest(await taskUrl(task.id), "PATCH", { description: html }))
        setLocal(task.id, { description: html })
        refreshWhenIdle("task-lists", () => mutate(isTasksKey))
      },

      setLocal,
    }),
    [apply, save, setLocal, mutate]
  )
}

export { isTempTaskId }
