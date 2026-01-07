import useSWR from 'swr'
import { useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'

export type TaskStatus = "NEW" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "TO_TRANSFER"

export interface Task {
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
  includeAssigned?: boolean
}

export function useTasks(options: UseTasksOptions = {}) {
  const { workspace } = useWorkspaceStore()

  // Build query string
  const params = new URLSearchParams({ workspace })
  if (options.date) params.append('date', options.date)
  if (options.from) params.append('from', options.from)
  if (options.to) params.append('to', options.to)
  // Always include assigned tasks by default
  params.append('includeAssigned', options.includeAssigned !== false ? 'true' : 'false')

  const url = `/api/tasks?${params.toString()}`

  const { data, error, isLoading, mutate } = useSWR<Task[]>(url)

  // Optimistic update helper
  const optimisticUpdate = useCallback(
    async (
      taskId: string,
      updates: Partial<Task>,
      serverUpdate: () => Promise<void>
    ) => {
      // Get current data
      const currentTasks = data ?? []

      // Optimistically update the UI
      const optimisticData = currentTasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )

      // Update the cache optimistically
      await mutate(optimisticData, false)

      try {
        // Perform the actual update
        await serverUpdate()
        // Revalidate to ensure consistency
        mutate()
      } catch (error) {
        // Rollback on error
        mutate(currentTasks, false)
        throw error
      }
    },
    [data, mutate]
  )

  // Optimistic delete helper
  const optimisticDelete = useCallback(
    async (taskId: string, serverDelete: () => Promise<void>) => {
      const currentTasks = data ?? []
      const optimisticData = currentTasks.filter((task) => task.id !== taskId)

      await mutate(optimisticData, false)

      try {
        await serverDelete()
        mutate()
      } catch (error) {
        mutate(currentTasks, false)
        throw error
      }
    },
    [data, mutate]
  )

  // Optimistic add helper
  const optimisticAdd = useCallback(
    async (tempTask: Partial<Task>, serverAdd: () => Promise<Task | null>) => {
      const currentTasks = data ?? []

      // Create a temporary task with a temp ID
      const tempId = `temp-${Date.now()}`
      const newTask: Task = {
        id: tempId,
        title: tempTask.title || '',
        status: 'NEW',
        priority: 0,
        actualMinutes: 0,
        orderInDay: currentTasks.length,
        ...tempTask,
      } as Task

      // Optimistically add to UI
      const optimisticData = [...currentTasks, newTask]
      await mutate(optimisticData, false)

      try {
        // Perform the actual add
        const createdTask = await serverAdd()
        // Revalidate to get the real data
        mutate()
        return createdTask
      } catch (error) {
        // Rollback on error
        mutate(currentTasks, false)
        throw error
      }
    },
    [data, mutate]
  )

  return {
    tasks: data ?? [],
    isLoading,
    isError: error,
    mutate,
    optimisticUpdate,
    optimisticDelete,
    optimisticAdd,
  }
}
