import useSWR from 'swr'
import { format } from 'date-fns'

interface SportActivityType {
  id: string
  name: string
  icon?: string
  color: string
  isDefault: boolean
  hasBodyParts: boolean
}

interface SportActivity {
  id: string
  date: string
  duration?: number
  notes?: string
  fromSteps: boolean
  type: SportActivityType
  bodyParts: { id: string; name: string }[]
}

interface StepsEntry {
  id: string
  date: string
  count: number
  notes?: string
  copiedToActivity: boolean
}

interface UseSportOptions {
  from?: Date
  to?: Date
}

export function useSportTypes() {
  const { data, error, isLoading, mutate } = useSWR<SportActivityType[]>(
    '/api/sport/types'
  )

  return {
    types: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}

export function useSportActivities(options: UseSportOptions = {}) {
  const params = new URLSearchParams()
  if (options.from) params.append('from', format(options.from, 'yyyy-MM-dd'))
  if (options.to) params.append('to', format(options.to, 'yyyy-MM-dd'))

  const { data, error, isLoading, mutate } = useSWR<SportActivity[]>(
    `/api/sport/activities?${params.toString()}`
  )

  return {
    activities: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}

export function useSteps(options: UseSportOptions = {}) {
  const params = new URLSearchParams()
  if (options.from) params.append('from', format(options.from, 'yyyy-MM-dd'))
  if (options.to) params.append('to', format(options.to, 'yyyy-MM-dd'))

  const { data, error, isLoading, mutate } = useSWR<StepsEntry[]>(
    `/api/sport/steps?${params.toString()}`
  )

  return {
    steps: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
