import { mutate } from "swr"
import { refreshWhenIdle } from "@/lib/pending-writes"

// Lists of the private trackers kept on the device (SWR keys). A click changes them
// at once; after the save every list of the kind is read again - also the ones
// counted from it (a challenge linked to a habit, the statistics).

const startsWith = (prefix: string) => (key: unknown) => typeof key === "string" && key.startsWith(prefix)

export const isHabitsKey = startsWith("/api/habits?")
export const isChallengesKey = startsWith("/api/challenges?")
export const isSportActivitiesKey = startsWith("/api/sport/activities?")
export const isStepsKey = startsWith("/api/sport/steps?")
export const isPrivateStatsKey = startsWith("/api/stats/private?")

type Kind = "habits" | "challenges" | "sport" | "steps"

const KEYS: Record<Kind, (key: unknown) => boolean> = {
  habits: isHabitsKey,
  challenges: isChallengesKey,
  sport: isSportActivitiesKey,
  steps: isStepsKey,
}

/**
 * Reads the lists again once nothing is being saved (a read in between would bring
 * back the state from before a click for a moment). Challenges and statistics are
 * counted from the rest, so they always go along.
 */
export function refreshPrivate(...kinds: Kind[]) {
  const all = new Set<Kind>([...kinds, "challenges"])
  refreshWhenIdle(`private:${Array.from(all).sort().join(",")}`, () => {
    all.forEach((kind) => mutate(KEYS[kind]))
    mutate(isPrivateStatsKey)
  })
}

/** Changes every kept list of a kind right away, without asking the server */
export function patchLists<T>(kind: Kind, change: (current: T) => T) {
  return mutate<T>(KEYS[kind], (current) => (current === undefined ? current : change(current)), {
    revalidate: false,
  })
}
