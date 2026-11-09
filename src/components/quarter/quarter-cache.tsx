"use client"

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react"
import { useSWRConfig } from "swr"
import { toast } from "sonner"
import { refreshWhenIdle, trackWrite } from "@/lib/pending-writes"
import {
  quarterApiKey,
  type QuarterGoal,
  type QuarterPayload,
  type QuarterRef,
  type QuarterResponse,
  type SprintCommitment,
} from "@/lib/quarters"

// The goals page shows a click at once and saves it in the background,
// instead of waiting for the save and a reload of the whole quarter

interface QuarterCache {
  /** Changes the quarter on screen (no request) */
  update: (change: (quarter: QuarterPayload) => QuarterPayload) => void
  /** Reloads the quarter once nothing is being saved */
  refresh: () => void
  /**
   * Shows the change, saves it and reloads the quarter afterwards.
   * On an error: message, and the reload brings back what the server has.
   */
  save: (change: ((quarter: QuarterPayload) => QuarterPayload) | null, write: () => Promise<unknown>, errorMessage?: string) => Promise<boolean>
}

const noop = () => {}
const QuarterCacheContext = createContext<QuarterCache>({
  update: noop,
  refresh: noop,
  save: async (_change, write) => {
    await write()
    return true
  },
})

export function QuarterCacheProvider({ quarterRef, children }: { quarterRef: QuarterRef; children: ReactNode }) {
  const { mutate } = useSWRConfig()
  const key = quarterApiKey(quarterRef)

  const update = useCallback(
    (change: (quarter: QuarterPayload) => QuarterPayload) => {
      mutate<QuarterResponse>(key, (data) => (data?.quarter ? { ...data, quarter: change(data.quarter) } : data), {
        revalidate: false,
      })
    },
    [mutate, key]
  )

  const refresh = useCallback(() => refreshWhenIdle(key, () => mutate(key)), [mutate, key])

  const save = useCallback<QuarterCache["save"]>(
    async (change, write, errorMessage = "Nie udało się zapisać") => {
      if (change) update(change)
      let ok = true
      try {
        await trackWrite(write)
      } catch (error) {
        ok = false
        toast.error(error instanceof Error && error.message !== "Coś poszło nie tak" ? error.message : errorMessage)
      }
      refresh()
      return ok
    },
    [update, refresh]
  )

  const value = useMemo(() => ({ update, refresh, save }), [update, refresh, save])
  return <QuarterCacheContext.Provider value={value}>{children}</QuarterCacheContext.Provider>
}

export const useQuarterCache = () => useContext(QuarterCacheContext)

// ---------- Changes of the quarter on screen ----------

export const updateGoal =
  (id: string, change: (goal: QuarterGoal) => QuarterGoal) =>
  (quarter: QuarterPayload): QuarterPayload => ({
    ...quarter,
    goals: quarter.goals.map((g) => (g.id === id ? change(g) : g)),
  })

export const removeGoal =
  (id: string) =>
  (quarter: QuarterPayload): QuarterPayload => ({
    ...quarter,
    goals: quarter.goals.filter((g) => g.id !== id),
    sprints: quarter.sprints.map((s) => ({
      ...s,
      commitments: s.commitments.filter((c) => c.parentGoalId !== id),
    })),
  })

export const updateCommitment =
  (id: string, change: (commitment: SprintCommitment) => SprintCommitment) =>
  (quarter: QuarterPayload): QuarterPayload => ({
    ...quarter,
    sprints: quarter.sprints.map((s) =>
      s.commitments.some((c) => c.id === id)
        ? { ...s, commitments: s.commitments.map((c) => (c.id === id ? change(c) : c)) }
        : s
    ),
  })
