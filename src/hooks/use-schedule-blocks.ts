import useSWR from 'swr'
import { useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'

export interface ScheduleBlock {
  id: string
  name: string
  description?: string | null
  dayOfWeek: number // 0=Monday, 6=Sunday
  startTime: string // HH:mm
  endTime: string // HH:mm
  color: string
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BlockData {
  name: string
  description?: string
  startTime: string
  endTime: string
  color?: string
  order?: number
}

interface DayBlocksResponse {
  isOverride: boolean
  date: string
  dayOfWeek?: number
  blocks: ScheduleBlock[] | BlockData[]
}

interface UseScheduleBlocksOptions {
  dayOfWeek?: number // Filter by specific day (0-6)
}

// Hook for fetching all weekly template blocks (for settings page)
export function useScheduleBlocks(options: UseScheduleBlocksOptions = {}) {
  const { workspace } = useWorkspaceStore()
  const { dayOfWeek } = options

  const params = new URLSearchParams({ workspace })
  if (dayOfWeek !== undefined) {
    params.set('dayOfWeek', dayOfWeek.toString())
  }

  const url = `/api/schedule-blocks?${params.toString()}`
  const { data, error, isLoading, mutate } = useSWR<ScheduleBlock[]>(url)

  // Optimistic add
  const optimisticAdd = useCallback(
    async (
      newBlock: Omit<ScheduleBlock, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>,
      serverAdd: () => Promise<{ id: string }>
    ) => {
      const currentBlocks = data ?? []
      const tempBlock = {
        ...newBlock,
        id: `temp-${Date.now()}`,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ScheduleBlock
      const optimisticData = [...currentBlocks, tempBlock].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.startTime.localeCompare(b.startTime)
      })

      await mutate(optimisticData, false)

      try {
        await serverAdd()
        mutate()
      } catch (error) {
        mutate(currentBlocks, false)
        throw error
      }
    },
    [data, mutate]
  )

  // Optimistic update
  const optimisticUpdate = useCallback(
    async (
      blockId: string,
      updates: Partial<ScheduleBlock>,
      serverUpdate: () => Promise<void>
    ) => {
      const currentBlocks = data ?? []
      const optimisticData = currentBlocks.map((block) =>
        block.id === blockId ? { ...block, ...updates } : block
      )

      await mutate(optimisticData, false)

      try {
        await serverUpdate()
        mutate()
      } catch (error) {
        mutate(currentBlocks, false)
        throw error
      }
    },
    [data, mutate]
  )

  // Optimistic delete
  const optimisticDelete = useCallback(
    async (blockId: string, serverDelete: () => Promise<void>) => {
      const currentBlocks = data ?? []
      const optimisticData = currentBlocks.filter((block) => block.id !== blockId)

      await mutate(optimisticData, false)

      try {
        await serverDelete()
        mutate()
      } catch (error) {
        mutate(currentBlocks, false)
        throw error
      }
    },
    [data, mutate]
  )

  return {
    blocks: data ?? [],
    isLoading,
    isError: error,
    mutate,
    optimisticAdd,
    optimisticUpdate,
    optimisticDelete,
  }
}

// Hook for fetching blocks for a specific date (checks override first, then template)
export function useDayBlocks(date: string | null) {
  const { workspace } = useWorkspaceStore()

  const url = date ? `/api/schedule-blocks?workspace=${workspace}&date=${date}` : null

  const { data, error, isLoading, mutate } = useSWR<DayBlocksResponse>(url, {
    keepPreviousData: true, // Keep showing previous day's blocks while loading
    revalidateOnFocus: false,
  })

  return {
    data: data ?? null,
    isOverride: data?.isOverride ?? false,
    blocks: (data?.blocks ?? []) as BlockData[],
    isLoading,
    isError: error,
    mutate,
  }
}

// Hook for managing daily overrides
export function useScheduleOverride(date: string | null) {
  const { workspace } = useWorkspaceStore()

  const url = date ? `/api/schedule-blocks/override?workspace=${workspace}&date=${date}` : null
  const { data, error, isLoading, mutate } = useSWR(url, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })

  // Save override for this date
  const saveOverride = useCallback(
    async (blocks: BlockData[]) => {
      if (!date) return

      await fetch('/api/schedule-blocks/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          blocks,
          workspaceType: workspace,
        }),
      })

      mutate()
    },
    [date, workspace, mutate]
  )

  // Remove override (revert to template)
  const removeOverride = useCallback(async () => {
    if (!date) return

    await fetch(`/api/schedule-blocks/override?workspace=${workspace}&date=${date}`, {
      method: 'DELETE',
    })

    mutate()
  }, [date, workspace, mutate])

  return {
    exists: data?.exists ?? false,
    override: data?.override ?? null,
    isLoading,
    isError: error,
    mutate,
    saveOverride,
    removeOverride,
  }
}
