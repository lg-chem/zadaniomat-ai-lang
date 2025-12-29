import useSWR from 'swr'
import { format, addDays } from 'date-fns'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface TaskCount {
  date: string
  count: number
}

export function useTaskCounts(centerDate: Date, daysRange: number = 30) {
  const { workspace } = useWorkspaceStore()

  // Calculate date range
  const from = format(addDays(centerDate, -7), 'yyyy-MM-dd')
  const to = format(addDays(centerDate, daysRange), 'yyyy-MM-dd')

  const url = `/api/tasks/counts?workspace=${workspace}&from=${from}&to=${to}`

  const { data, error, isLoading } = useSWR<TaskCount[]>(url, {
    // Keep this data fresh but don't refetch too often
    revalidateOnFocus: false,
    dedupingInterval: 30000, // 30 seconds
  })

  return {
    taskCounts: data ?? [],
    isLoading,
    isError: error,
  }
}
