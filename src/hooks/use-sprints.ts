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

  // Find current sprint based on today's date (not just isActive flag)
  const findCurrentSprint = (sprints: Sprint[]): Sprint | null => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Only a sprint that contains today counts - the isActive flag is never switched off,
    // so falling back to it showed long-finished sprints as active
    return sprints.find(s => {
      const start = new Date(s.startDate)
      const end = new Date(s.endDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return today >= start && today <= end
    }) ?? null
  }

  return {
    sprints: data ?? [],
    activeSprint: data ? findCurrentSprint(data) : null,
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
