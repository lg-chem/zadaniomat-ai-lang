// Changes shown on screen right away, before the server confirms them.
// Refreshes asked for meanwhile wait until no change is being saved: a refresh
// in between would bring back the state from before a click for a moment.

let pending = 0
const refreshes = new Map<string, () => unknown>()

function flush() {
  if (pending > 0 || refreshes.size === 0) return
  const due = Array.from(refreshes.values())
  refreshes.clear()
  for (const refresh of due) refresh()
}

/** Saves a change that is already on screen */
export async function trackWrite<T>(write: () => Promise<T>): Promise<T> {
  pending++
  try {
    return await write()
  } finally {
    pending--
    flush()
  }
}

/** Runs the refresh once no change is being saved; the same id asked twice runs once */
export function refreshWhenIdle(id: string, refresh: () => unknown) {
  refreshes.set(id, refresh)
  flush()
}

/** JSON request that throws with the API error message */
export async function jsonRequest<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || "Coś poszło nie tak")
  }
  return data as T
}
