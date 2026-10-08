import { mutate } from "swr"
import { toast } from "sonner"
import { useTimerStore, type TimerSessionResult } from "@/stores/timer-store"
import { isTasksKey, trackTaskWrite } from "@/lib/task-writes"

interface TimerTask {
  id: string
  title: string
  plannedMinutes?: number | null
  actualMinutes?: number | null
  actualExtraSeconds?: number | null
}

// Time already worked on a task, in seconds
export function taskWorkedSeconds(task: Pick<TimerTask, "actualMinutes" | "actualExtraSeconds">) {
  return (task.actualMinutes || 0) * 60 + (task.actualExtraSeconds || 0)
}

// Fired after a session's time is saved, for pages that don't read tasks through SWR
export const TIMER_SESSION_SAVED_EVENT = "timer-session-saved"

type CachedTask = TimerTask & { status?: string; completedAt?: string | null }

// The task as it will be once the session is saved - same math as the server
function withSavedSession(task: CachedTask, result: TimerSessionResult, complete: boolean): CachedTask {
  let actualMinutes: number
  let actualExtraSeconds: number
  if (result.totalSeconds !== undefined) {
    // Session migrated from the old timer - saved as whole minutes
    actualMinutes = Math.round(result.totalSeconds / 60)
    actualExtraSeconds = 0
  } else {
    const totalSeconds = taskWorkedSeconds(task) + result.sessionSeconds
    actualMinutes = Math.floor(totalSeconds / 60)
    actualExtraSeconds = totalSeconds % 60
  }

  return {
    ...task,
    actualMinutes,
    actualExtraSeconds,
    ...(complete && { status: "COMPLETED", completedAt: task.completedAt || new Date().toISOString() }),
  }
}

// Shows the saved session in every cached task list right away,
// instead of waiting for the server and a refetch
function showSessionInTaskLists(result: TimerSessionResult, complete: boolean) {
  const update = (item: unknown) =>
    item && typeof item === "object" && (item as CachedTask).id === result.taskId
      ? withSavedSession(item as CachedTask, result, complete)
      : item

  mutate(isTasksKey, (data: unknown) => (Array.isArray(data) ? data.map(update) : update(data)), {
    revalidate: false,
  })
}

async function sendTaskRequest(url: string, method: string, body: object, errorMessage: string) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(errorMessage)
}

// Saves a finished timer session: adds the worked time to the task
// and optionally marks the task as completed
export async function saveTimerSession(result: TimerSessionResult, options: { complete?: boolean } = {}) {
  const { taskId } = result
  const complete = options.complete === true

  showSessionInTaskLists(result, complete)

  try {
    await trackTaskWrite(async () => {
      const requests: Promise<void>[] = []

      if (result.totalSeconds !== undefined) {
        // Session migrated from the old timer - it holds the task's total time
        requests.push(sendTaskRequest(`/api/tasks/${taskId}`, "PATCH", {
          actualMinutes: Math.round(result.totalSeconds / 60),
          ...(complete && { status: "COMPLETED" }),
        }, "Failed to save time"))
      } else {
        // Saved to the second: 0:22 adds 22 s
        if (result.sessionSeconds > 0) {
          requests.push(sendTaskRequest(`/api/tasks/${taskId}/time`, "POST", {
            durationSeconds: result.sessionSeconds,
          }, "Failed to save time"))
        }

        // Sent alongside the time, not after it - they change different fields
        if (complete) {
          requests.push(sendTaskRequest(`/api/tasks/${taskId}`, "PATCH", {
            status: "COMPLETED",
          }, "Failed to complete task"))
        }
      }

      // Wait for every request, so the lists refresh only once all of them are saved
      const failed = (await Promise.allSettled(requests)).find((r) => r.status === "rejected")
      if (failed) throw (failed as PromiseRejectedResult).reason
    })
  } catch (error) {
    console.error("Error saving timer session:", error)
    toast.error("Nie udało się zapisać czasu pracy")
  } finally {
    window.dispatchEvent(new CustomEvent(TIMER_SESSION_SAVED_EVENT, { detail: { taskId } }))
  }
}

// Stops the active timer and saves its time to the task
export async function stopActiveTimer() {
  const result = useTimerStore.getState().stopTimer()
  if (result) await saveTimerSession(result)
}

// Stops the active timer, saves its time and marks the task as completed
export async function completeActiveTimer() {
  const result = useTimerStore.getState().completeTask()
  if (result) await saveTimerSession(result, { complete: true })
}

// Stops the timer if it runs for this task - e.g. when the task is completed elsewhere
export async function stopTimerForTask(taskId: string, options: { complete?: boolean } = {}) {
  const store = useTimerStore.getState()
  if (!store.isRunning || store.taskId !== taskId) return

  const result = options.complete ? store.completeTask() : store.stopTimer()
  // Status is changed by the caller
  if (result) await saveTimerSession(result)
}

// Drops the timer of a deleted task - there is nothing to save its time to
export function discardTimerForTask(taskId: string) {
  const store = useTimerStore.getState()
  if (store.taskId === taskId) store.reset()
}

// Starts the timer for a task. A timer running for another task is stopped
// and its time saved first, so switching tasks never loses worked time.
export function startTaskTimer(task: TimerTask) {
  const store = useTimerStore.getState()

  if (store.isRunning && store.taskId !== task.id) {
    const result = store.stopTimer()
    if (result) saveTimerSession(result)
  }

  useTimerStore.getState().startTimer(
    task.id,
    task.title,
    task.plannedMinutes || undefined,
    taskWorkedSeconds(task)
  )
}
