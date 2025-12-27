import useSWR from 'swr'

interface Challenge {
  id: string
  name: string
  description?: string
  challengeType: 'NUMERIC' | 'WEEKLY_HABIT' | 'MONTHLY_GOAL'
  startDate: string
  endDate: string
  targetValue: number
  currentValue: number
  unit: string
  weeklyTarget?: number
  isCompleted: boolean
  color: string
  milestones: {
    id: string
    name: string
    targetValue: number
    isReached: boolean
    reachedAt?: string
  }[]
  entries: {
    id: string
    date: string
    value: number
    notes?: string
  }[]
}

export function useChallenges() {
  const { data, error, isLoading, mutate } = useSWR<Challenge[]>(
    '/api/challenges'
  )

  return {
    challenges: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
