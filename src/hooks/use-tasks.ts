import useSWR from 'swr'
import { useWorkspaceStore } from '@/stores/workspace-store'

type TaskStatus = "NEW" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "TO_TRANSFER"

interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: number
  plannedMinutes?: number
  actualMinutes: number
  scheduledDate?: string
  scheduledTime?: string
  orderInDay: number
  categoryId?: string | null
  goalId?: string | null
  isRecurring?: boolean
  recurrenceRule?: string | null
  category?: {
    id: string
    name: string
    color: string
  }
  goal?: {
    id: string
    title: string
  } | null
}

interface UseTasksOptions {
  date?: string
  from?: string
  to?: string
}

export function useTasks(options: UseTasksOptions = {}) {
  const { workspace } = useWorkspaceStore()

  // Build query string
  const params = new URLSearchParams({ workspace })
  if (options.date) params.append('date', options.date)
  if (options.from) params.append('from', options.from)
  if (options.to) params.append('to', options.to)

  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    `/api/tasks?${params.toString()}`
  )

  return {
    tasks: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
