import useSWR from 'swr'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { useMemo } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface TaskCount {
  date: string
  count: number
}

export function useTaskCounts(centerDate: Date, _daysRange: number = 30) {
  const { workspace } = useWorkspaceStore()

  // Use stable month-based range to prevent refetches when clicking between days
  // Fetch 3 months: previous, current, and next month
  const { from, to } = useMemo(() => {
    const monthStart = startOfMonth(centerDate)
    return {
      from: format(subMonths(monthStart, 1), 'yyyy-MM-dd'),
      to: format(endOfMonth(addMonths(monthStart, 1)), 'yyyy-MM-dd'),
    }
  }, [centerDate.getFullYear(), centerDate.getMonth()]) // Only recalculate when month changes

  const url = `/api/tasks/counts?workspace=${workspace}&from=${from}&to=${to}`

  const { data, error, isLoading, mutate } = useSWR<TaskCount[]>(url, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 60 seconds
  })

  return {
    taskCounts: data ?? [],
    isLoading,
    isError: error,
    mutate, // Export mutate so schedule can update counts after task changes
  }
}
