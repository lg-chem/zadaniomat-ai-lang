import { mutate } from "swr"
import { toast } from "sonner"
import { useTimerStore, type TimerSessionResult } from "@/stores/timer-store"

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

// Saves a finished timer session: adds the worked time to the task
// and optionally marks the task as completed
export async function saveTimerSession(result: TimerSessionResult, options: { complete?: boolean } = {}) {
  const { taskId } = result

  try {
    if (result.totalSeconds !== undefined) {
      // Session migrated from the old timer - it holds the task's total time
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualMinutes: Math.round(result.totalSeconds / 60),
          ...(options.complete && { status: "COMPLETED" }),
        }),
      })
      if (!res.ok) throw new Error("Failed to save time")
    } else {
      // Saved to the second: 0:22 adds 22 s
      if (result.sessionSeconds > 0) {
        const res = await fetch(`/api/tasks/${taskId}/time`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationSeconds: result.sessionSeconds }),
        })
        if (!res.ok) throw new Error("Failed to save time")
      }

      if (options.complete) {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        })
        if (!res.ok) throw new Error("Failed to complete task")
      }
    }
  } catch (error) {
    console.error("Error saving timer session:", error)
    toast.error("Nie udało się zapisać czasu pracy")
  } finally {
    // Refresh tasks data so UI updates immediately
    mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"))
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
