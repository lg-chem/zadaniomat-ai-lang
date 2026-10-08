import { mutate } from "swr"

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
