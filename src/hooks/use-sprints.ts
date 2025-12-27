import useSWR from 'swr'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  period: {
    id: string
    name: string
  }
  goals: {
    id: string
    title: string
    targetValue?: number
    currentValue: number
    unit?: string
    isCompleted: boolean
    category?: {
      id: string
      name: string
      color: string
    }
  }[]
}

interface Period {
  id: string
  name: string
  startDate: string
  endDate: string
  workspaceType: 'WORK' | 'PRIVATE'
  isActive: boolean
  goals: {
    id: string
    title: string
    targetValue?: number
    currentValue: number
    unit?: string
    isCompleted: boolean
  }[]
}

export function useSprints() {
  const { workspace } = useWorkspaceStore()

  const { data, error, isLoading, mutate } = useSWR<Sprint[]>(
    `/api/sprints?workspace=${workspace}`
  )

  return {
    sprints: data ?? [],
    activeSprint: data?.find(s => s.isActive) ?? null,
    isLoading,
    isError: error,
    mutate,
  }
}

export function usePeriods() {
  const { workspace } = useWorkspaceStore()

  const { data, error, isLoading, mutate } = useSWR<Period[]>(
    `/api/periods?workspace=${workspace}`
  )

  return {
    periods: data ?? [],
    activePeriod: data?.find(p => p.isActive) ?? null,
    isLoading,
    isError: error,
    mutate,
  }
}
