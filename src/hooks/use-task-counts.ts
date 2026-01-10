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
  })

  // Optimistic increment for a specific date
  const incrementCount = (date: string) => {
    const currentCounts = data ?? []
    const existingIndex = currentCounts.findIndex(c => c.date === date)

    let newCounts: TaskCount[]
    if (existingIndex >= 0) {
      newCounts = currentCounts.map((c, i) =>
        i === existingIndex ? { ...c, count: c.count + 1 } : c
      )
    } else {
      newCounts = [...currentCounts, { date, count: 1 }]
    }

    mutate(newCounts, { revalidate: false })
  }

  // Optimistic decrement for a specific date
  const decrementCount = (date: string) => {
    const currentCounts = data ?? []
    const newCounts = currentCounts.map(c =>
      c.date === date ? { ...c, count: Math.max(0, c.count - 1) } : c
    ).filter(c => c.count > 0)

    mutate(newCounts, { revalidate: false })
  }

  return {
    taskCounts: data ?? [],
    isLoading,
    isError: error,
    mutate,
    incrementCount,
    decrementCount,
  }
}
