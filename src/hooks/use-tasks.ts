import useSWR from 'swr'
import { useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'

export type TaskStatus = "NEW" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "TO_TRANSFER"

export interface Subtask {
  id: string
  title: string
  isCompleted: boolean
  order: number
}

export interface Task {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: number
  plannedMinutes?: number | null
  actualMinutes: number
  scheduledDate?: string | null
  scheduledTime?: string | null
  orderInDay: number
  categoryId?: string | null
  goalId?: string | null
  isRecurring?: boolean
  recurrenceRule?: string | null
  category?: {
    id: string
    name: string
    color: string
  } | null
  goal?: {
    id: string
    title: string
  } | null
  subtasks?: Subtask[]
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

  const { data, error, isLoading, mutate } = useSWR<Task[]>(url, {
    keepPreviousData: true, // Keep showing previous day's tasks while loading new day
    revalidateOnFocus: false,
  })

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
      // IMPORTANT: spread tempTask FIRST, then apply defaults for missing fields
      // This ensures that if tempTask has a value, it won't be overwritten by undefined from spread
      const tempId = `temp-${Date.now()}`
      const newTask: Task = {
        ...tempTask,
        id: tempId,
        title: tempTask.title || '',
        status: tempTask.status || 'NEW',
        priority: tempTask.priority ?? 0,
        actualMinutes: tempTask.actualMinutes ?? 0,
        orderInDay: tempTask.orderInDay ?? currentTasks.length,
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
