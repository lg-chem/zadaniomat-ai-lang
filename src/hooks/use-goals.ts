import useSWR from 'swr'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface Goal {
  id: string
  title: string
  description?: string
  targetValue?: number
  currentValue: number
  unit?: string
  isCompleted: boolean
  isStep?: boolean
  parentGoalId?: string
  order?: number
  category?: {
    id: string
    name: string
    color: string
  }
  period?: {
    id: string
    name: string
  }
  sprint?: {
    id: string
    name: string
  }
}

interface UseGoalsOptions {
  periodId?: string
  sprintId?: string
}

export function useGoals(options: UseGoalsOptions = {}) {
  const { workspace } = useWorkspaceStore()

  // Build query string
  const params = new URLSearchParams({ workspace })
  if (options.periodId) params.append('periodId', options.periodId)
  if (options.sprintId) params.append('sprintId', options.sprintId)

  const { data, error, isLoading, mutate } = useSWR<Goal[]>(
    `/api/goals?${params.toString()}`
  )

  return {
    goals: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
