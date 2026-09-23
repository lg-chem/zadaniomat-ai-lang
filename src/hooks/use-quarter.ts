import useSWR from 'swr'
import { quarterApiKey, type QuarterRef, type QuarterResponse } from '@/lib/quarters'

/**
 * Calendar quarter view (goals, key results, sprints). Pass null to wait.
 * `quarter` is null when the quarter was not planned yet.
 */
export function useQuarter(ref: QuarterRef | null) {
  const { data, error, isLoading, mutate } = useSWR<QuarterResponse>(
    ref ? quarterApiKey(ref) : null
  )

  return {
    quarter: data?.quarter ?? null,
    history: data?.history ?? { sprints: 0, done: 0, total: 0 },
    hasQuarters: data?.hasQuarters ?? false,
    isLoaded: data !== undefined,
    isLoading,
    isError: error,
    mutate,
  }
}

/** JSON request helper for the quarter module - throws with the API error message */
export async function quarterRequest<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || 'Coś poszło nie tak')
  }
  return data as T
}
