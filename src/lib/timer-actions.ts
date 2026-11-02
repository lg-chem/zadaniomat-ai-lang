import { mutate } from "swr"
import { toast } from "sonner"
import { useTimerStore, formatTime, type TimerSessionResult } from "@/stores/timer-store"
import { isTasksKey, isTempTaskId, resolveTaskId, trackTaskWrite } from "@/lib/task-writes"

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

interface TaskRequest {
  url: string
  method: string
  body: object
}

// The server answered with an error (status) or could not be reached (no status)
class TaskRequestError extends Error {
  constructor(readonly status?: number) {
    super(status ? `Task request failed with status ${status}` : "Task request failed")
  }
}

// Short server or connection hiccups are tried again before giving up - only errors
// after which nothing is saved, so time is never added twice: the server rolls
// the time back on its own error (500), 503 means it didn't take the request,
// and without a connection the request doesn't reach it.
const RETRY_DELAYS_MS = [1000, 3000]
const isRetryable = (error: TaskRequestError) =>
  error.status === undefined || error.status === 500 || error.status === 503

async function sendOnce({ url, method, body }: TaskRequest) {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new TaskRequestError()
  }
  if (!res.ok) throw new TaskRequestError(res.status)
}

async function sendTaskRequest(request: TaskRequest) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await sendOnce(request)
    } catch (error) {
      const err = error as TaskRequestError
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(err)) throw err
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
    }
  }
}

// Requests that save a finished session
function sessionRequests(result: TimerSessionResult, complete: boolean): TaskRequest[] {
  const { taskId } = result
  const requests: TaskRequest[] = []

  if (result.totalSeconds !== undefined) {
    // Session migrated from the old timer - it holds the task's total time
    requests.push({
      url: `/api/tasks/${taskId}`,
      method: "PATCH",
      body: { actualMinutes: Math.round(result.totalSeconds / 60), ...(complete && { status: "COMPLETED" }) },
    })
    return requests
  }

  // Saved to the second: 0:22 adds 22 s
  if (result.sessionSeconds > 0) {
    requests.push({ url: `/api/tasks/${taskId}/time`, method: "POST", body: { durationSeconds: result.sessionSeconds } })
  }
  if (complete) {
    requests.push({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { status: "COMPLETED" } })
  }
  return requests
}

function saveErrorMessage(error: unknown) {
  const status = error instanceof TaskRequestError ? error.status : undefined
  if (status === 404) return "Nie udało się zapisać czasu pracy - nie ma już tego zadania"
  if (status === 401) return "Nie udało się zapisać czasu pracy - zaloguj się ponownie"
  if (status === undefined) return "Nie udało się zapisać czasu pracy - brak połączenia"
  return "Nie udało się zapisać czasu pracy"
}

// Sends the requests of a session and reports the ones that failed,
// with an option to send just those again - so worked time isn't lost
async function saveSessionRequests(taskId: string, requests: TaskRequest[], workedTime: string) {
  const failed: TaskRequest[] = []
  let error: unknown

  try {
    await trackTaskWrite(async () => {
      // Sent together, not one after another - they change different fields.
      // Wait for every request, so the lists refresh only once all of them are saved.
      const results = await Promise.allSettled(requests.map(sendTaskRequest))
      results.forEach((r, i) => {
        if (r.status === "fulfilled") return
        failed.push(requests[i])
        error ??= r.reason
      })
    })
  } finally {
    window.dispatchEvent(new CustomEvent(TIMER_SESSION_SAVED_EVENT, { detail: { taskId } }))
  }

  if (failed.length === 0) return
  console.error("Error saving timer session:", error)

  // A missing task can't be saved to - trying again won't help
  const canRetry = !(error instanceof TaskRequestError && error.status === 404)
  toast.error(saveErrorMessage(error), {
    description: `Czas sesji: ${workedTime}`,
    duration: canRetry ? 15000 : 6000,
    ...(canRetry && {
      action: { label: "Ponów", onClick: () => saveSessionRequests(taskId, failed, workedTime) },
    }),
  })
}

// Saves a finished timer session: adds the worked time to the task
// and optionally marks the task as completed
export async function saveTimerSession(result: TimerSessionResult, options: { complete?: boolean } = {}) {
  const complete = options.complete === true
  const workedTime = formatTime(result.sessionSeconds)

  // The timer may have run on a task added a moment ago - wait until it's saved
  const taskId = isTempTaskId(result.taskId) ? await resolveTaskId(result.taskId) : result.taskId
  if (!taskId) {
    toast.error("Nie udało się zapisać czasu pracy - zadanie nie zostało zapisane", {
      description: `Czas sesji: ${workedTime}`,
    })
    return
  }

  const session = { ...result, taskId }
  showSessionInTaskLists(session, complete)
  await saveSessionRequests(taskId, sessionRequests(session, complete), workedTime)
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
