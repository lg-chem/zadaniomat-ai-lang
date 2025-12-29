import useSWR from 'swr'
import { useCallback } from 'react'
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

  const url = `/api/backlog?${params.toString()}`

  const { data, error, isLoading, mutate } = useSWR<BacklogItem[]>(url)

  // Optimistic update helper
  const optimisticUpdate = useCallback(
    async (
      itemId: string,
      updates: Partial<BacklogItem>,
      serverUpdate: () => Promise<void>
    ) => {
      const currentItems = data ?? []
      const optimisticData = currentItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )

      await mutate(optimisticData, false)

      try {
        await serverUpdate()
        mutate()
      } catch (error) {
        mutate(currentItems, false)
        throw error
      }
    },
    [data, mutate]
  )

  // Optimistic delete helper
  const optimisticDelete = useCallback(
    async (itemId: string, serverDelete: () => Promise<void>) => {
      const currentItems = data ?? []
      const optimisticData = currentItems.filter((item) => item.id !== itemId)

      await mutate(optimisticData, false)

      try {
        await serverDelete()
        mutate()
      } catch (error) {
        mutate(currentItems, false)
        throw error
      }
    },
    [data, mutate]
  )

  // Optimistic add helper
  const optimisticAdd = useCallback(
    async (newItem: Omit<BacklogItem, 'id'>, serverAdd: () => Promise<{ id: string }>) => {
      const currentItems = data ?? []
      const tempItem = { ...newItem, id: `temp-${Date.now()}` } as BacklogItem
      const optimisticData = [tempItem, ...currentItems]

      await mutate(optimisticData, false)

      try {
        await serverAdd()
        mutate()
      } catch (error) {
        mutate(currentItems, false)
        throw error
      }
    },
    [data, mutate]
  )

  return {
    items: data ?? [],
    isLoading,
    isError: error,
    mutate,
    optimisticUpdate,
    optimisticDelete,
    optimisticAdd,
  }
}
