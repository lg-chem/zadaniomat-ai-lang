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

    // First, try to find a sprint where today is within the date range
    const currentByDate = sprints.find(s => {
      const start = new Date(s.startDate)
      const end = new Date(s.endDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return today >= start && today <= end
    })

    if (currentByDate) return currentByDate

    // Fallback to isActive flag if no date match
    return sprints.find(s => s.isActive) ?? null
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
