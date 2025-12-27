import useSWR from 'swr'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface Habit {
  id: string
  name: string
  description?: string
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  targetCount: number
  defaultMinutes?: number
  color: string
  icon?: string
  currentStreak: number
  longestStreak: number
  isActive: boolean
  category?: {
    id: string
    name: string
    color: string
  }
}

export function useHabits() {
  const { workspace } = useWorkspaceStore()

  const { data, error, isLoading, mutate } = useSWR<Habit[]>(
    workspace === 'PRIVATE' ? '/api/habits' : null
  )

  return {
    habits: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
