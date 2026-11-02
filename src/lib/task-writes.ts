import { mutate } from "swr"
import { useTimerStore } from "@/stores/timer-store"

// Every cached task list: a day, a range, overdue tasks, counts...
export const isTasksKey = (key: unknown) => typeof key === "string" && key.startsWith("/api/tasks")

// Task changes still being saved on the server
let pendingWrites = 0

// Saves a task change already shown in the lists, then refreshes the lists once
// no other change is still being saved. A refresh in between would bring back a
// half-saved state for a moment - e.g. a stopped timer's time saved, but not the
// status changed together with it. On an error the refresh also undoes the change.
export async function trackTaskWrite<T>(write: () => Promise<T>): Promise<T> {
  pendingWrites++
  try {
    return await write()
  } finally {
    pendingWrites--
    if (pendingWrites === 0) mutate(isTasksKey)
  }
}

// A task added on the page is shown right away, under a temporary id,
// until the server saves it and gives it its real id
export const isTempTaskId = (id: string) => id.startsWith("temp-")

// Real ids of tasks added on this page, by their temporary id
const createdTaskIds = new Map<string, Promise<string | null>>()

// Remembers which real id a temporary task gets once the server saves it.
// A timer started on the task in the meantime keeps counting under the real id.
export function trackTaskCreate(tempId: string, realId: Promise<string | null>) {
  const saved = realId.catch(() => null)
  createdTaskIds.set(tempId, saved)
  saved.then((id) => {
    if (id) useTimerStore.getState().replaceTaskId(tempId, id)
  })
}

// The id to send to the server: waits for a task that is still being saved.
// null - the task was never saved (it failed, or the page was reloaded meanwhile).
export async function resolveTaskId(id: string): Promise<string | null> {
  if (!isTempTaskId(id)) return id
  return (await createdTaskIds.get(id)) ?? null
}
