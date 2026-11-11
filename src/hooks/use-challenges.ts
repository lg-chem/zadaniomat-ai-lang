import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { jsonRequest, trackWrite } from '@/lib/pending-writes'
import { patchLists, refreshPrivate } from '@/lib/private-sync'
import {
  challengeProgress,
  dayKeyOf,
  monthKeyOf,
  todayKey,
  type ChallengeType,
  type LinkedMetric,
  type LinkedType,
} from '@/lib/tracking'

export interface ChallengeEntry {
  id: string
  date: string
  value: number
  notes?: string | null
}

export interface ChallengeMilestone {
  id: string
  name: string
  targetValue: number
  isReached: boolean
  reachedAt?: string | null
}

export interface Challenge {
  id: string
  name: string
  description?: string | null
  challengeType: ChallengeType
  startDate: string
  endDate: string
  targetValue: number
  currentValue: number
  unit: string
  weeklyTarget?: number | null
  /** Closed: moved to the finished ones (by reaching a weekly / monthly target or by hand) */
  isCompleted: boolean
  isPublic?: boolean
  color: string
  /** Counted from a habit / sport / steps instead of own entries */
  linkedType: LinkedType
  linkedHabitId?: string | null
  linkedSportTypeId?: string | null
  linkedMetric: LinkedMetric
  /** What it is counted from, in words; null - own entries */
  linkedLabel?: string | null
  milestones: ChallengeMilestone[]
  entries: ChallengeEntry[]
}

export interface ChallengeInput {
  name: string
  description?: string
  challengeType: ChallengeType
  startDate: string
  endDate: string
  targetValue: string
  unit: string
  weeklyTarget?: string
  color: string
  isPublic: boolean
  linkedType: LinkedType
  linkedHabitId?: string | null
  linkedSportTypeId?: string | null
  linkedMetric: LinkedMetric
}

export const challengesKey = (showCompleted = false) => `/api/challenges?showCompleted=${showCompleted}`

export const isLinked = (challenge: Pick<Challenge, 'linkedType'>) => challenge.linkedType !== 'NONE'

function withEntries(challenge: Challenge, entries: ChallengeEntry[]): Challenge {
  return {
    ...challenge,
    entries,
    currentValue: challengeProgress(challenge.challengeType, entries, challenge.startDate, challenge.weeklyTarget),
  }
}

const patchChallenge = (id: string, change: (challenge: Challenge) => Challenge) =>
  patchLists<Challenge[]>('challenges', (list) => list.map((c) => (c.id === id ? change(c) : c)))

/** Challenges with their entries. Progress added by hand shows at once and is saved in the background. */
export function useChallenges(showCompleted = false) {
  const { data, error, isLoading, mutate } = useSWR<Challenge[]>(challengesKey(showCompleted))

  const save = useCallback(async (write: () => Promise<unknown>, failed: string) => {
    try {
      await trackWrite(write)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failed)
      return false
    } finally {
      refreshPrivate('challenges')
    }
  }, [])

  /** Adds progress (numeric challenges): "+5 km", "+200 zł" */
  const addEntry = useCallback(
    async (challengeId: string, value: number, day: string = todayKey()) => {
      const entry: ChallengeEntry = { id: `temp-${Date.now()}`, date: `${day}T00:00:00.000Z`, value }
      await patchChallenge(challengeId, (c) => withEntries(c, [entry, ...c.entries]))
      return save(
        () => jsonRequest(`/api/challenges/${challengeId}/entry`, 'POST', { value, date: day }),
        'Nie udało się dodać postępu'
      )
    },
    [save]
  )

  /** Ticks / unticks a day (weekly) or a month (monthly) */
  const toggleDay = useCallback(
    async (challenge: Challenge, day: string) => {
      const sameSlot = (entry: ChallengeEntry) =>
        challenge.challengeType === 'MONTHLY_GOAL'
          ? monthKeyOf(dayKeyOf(entry.date)) === monthKeyOf(day)
          : dayKeyOf(entry.date) === day
      const existing = challenge.entries.find(sameSlot)
      await patchChallenge(challenge.id, (c) =>
        withEntries(
          c,
          existing
            ? c.entries.filter((e) => !sameSlot(e))
            : [{ id: `temp-${Date.now()}`, date: `${day}T00:00:00.000Z`, value: 1 }, ...c.entries]
        )
      )
      return save(
        () =>
          existing && !existing.id.startsWith('temp-')
            ? jsonRequest(`/api/challenges/${challenge.id}/entry?entryId=${existing.id}`, 'DELETE')
            : jsonRequest(`/api/challenges/${challenge.id}/entry`, 'POST', { value: 1, date: day, toggle: true }),
        'Nie udało się zapisać'
      )
    },
    [save]
  )

  const updateEntry = useCallback(
    async (challengeId: string, entryId: string, value: number) => {
      await patchChallenge(challengeId, (c) =>
        withEntries(c, c.entries.map((e) => (e.id === entryId ? { ...e, value } : e)))
      )
      return save(
        () => jsonRequest(`/api/challenges/${challengeId}/entry`, 'PATCH', { entryId, value }),
        'Nie udało się zapisać wpisu'
      )
    },
    [save]
  )

  const removeEntry = useCallback(
    async (challengeId: string, entryId: string) => {
      await patchChallenge(challengeId, (c) => withEntries(c, c.entries.filter((e) => e.id !== entryId)))
      return save(
        () => jsonRequest(`/api/challenges/${challengeId}/entry?entryId=${entryId}`, 'DELETE'),
        'Nie udało się usunąć wpisu'
      )
    },
    [save]
  )

  const createChallenge = useCallback(
    (input: ChallengeInput) => save(() => jsonRequest('/api/challenges', 'POST', input), 'Nie udało się utworzyć wyzwania'),
    [save]
  )

  const updateChallenge = useCallback(
    (id: string, input: Partial<ChallengeInput> & { isCompleted?: boolean }) =>
      save(() => jsonRequest(`/api/challenges/${id}`, 'PATCH', input), 'Nie udało się zapisać wyzwania'),
    [save]
  )

  /** Closes a challenge (moves it to the finished ones) or brings it back */
  const setCompleted = useCallback(
    async (id: string, isCompleted: boolean) => {
      await patchChallenge(id, (c) => ({ ...c, isCompleted }))
      return save(() => jsonRequest(`/api/challenges/${id}`, 'PATCH', { isCompleted }), 'Nie udało się zapisać wyzwania')
    },
    [save]
  )

  const copyChallenge = useCallback(
    (id: string, input: { name: string; startDate: string; endDate: string; targetValue: string }) =>
      save(() => jsonRequest(`/api/challenges/${id}/copy`, 'POST', input), 'Nie udało się skopiować wyzwania'),
    [save]
  )

  const removeChallenge = useCallback(
    async (id: string) => {
      await patchLists<Challenge[]>('challenges', (list) => list.filter((c) => c.id !== id))
      return save(() => jsonRequest(`/api/challenges/${id}`, 'DELETE'), 'Nie udało się usunąć wyzwania')
    },
    [save]
  )

  // The list of the active ones drops a challenge the moment it is closed
  const challenges = useMemo(
    () => (showCompleted ? data ?? [] : (data ?? []).filter((c) => !c.isCompleted)),
    [data, showCompleted]
  )

  return {
    challenges,
    isLoading,
    isError: error,
    mutate,
    addEntry,
    toggleDay,
    updateEntry,
    removeEntry,
    createChallenge,
    updateChallenge,
    setCompleted,
    copyChallenge,
    removeChallenge,
  }
}
