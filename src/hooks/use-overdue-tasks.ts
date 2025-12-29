import useSWR from 'swr'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { Task } from './use-tasks'

export function useOverdueTasks() {
  const { workspace } = useWorkspaceStore()

  const url = `/api/tasks/overdue?workspace=${workspace}`

  const { data, error, isLoading, mutate } = useSWR<Task[]>(url)

  return {
    overdueTasks: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
