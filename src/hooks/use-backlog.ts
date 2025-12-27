import useSWR from 'swr'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface BacklogItem {
  id: string
  content: string
  priority: number
  isProcessed: boolean
  processedAt?: string | null
  createdAt: string
}

interface UseBacklogOptions {
  showProcessed?: boolean
}

export function useBacklog(options: UseBacklogOptions = {}) {
  const { workspace } = useWorkspaceStore()
  const { showProcessed = false } = options

  const params = new URLSearchParams({
    workspace,
    showProcessed: showProcessed.toString()
  })

  const { data, error, isLoading, mutate } = useSWR<BacklogItem[]>(
    `/api/backlog?${params.toString()}`
  )

  return {
    items: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
