import useSWR from 'swr'
import { useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { trackTaskWrite } from '@/lib/task-writes'

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
  actualExtraSeconds?: number
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
      let currentTasks: Task[] | undefined

      // Optimistically update the cache - from its current value, so a change made
      // since the last render (e.g. a stopped timer's time) isn't overwritten
      mutate((current) => {
        currentTasks = current
        return current?.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
      }, { revalidate: false })

      // Task lists are refreshed once it's saved
      await trackTaskWrite(async () => {
        try {
          await serverUpdate()
        } catch (error) {
          // Rollback on error
          mutate(currentTasks, { revalidate: false })
          throw error
        }
      })
    },
    [mutate]
  )

  // Optimistic delete helper
  const optimisticDelete = useCallback(
    async (taskId: string, serverDelete: () => Promise<void>) => {
      let currentTasks: Task[] | undefined

      mutate((current) => {
        currentTasks = current
        return current?.filter((task) => task.id !== taskId)
      }, { revalidate: false })

      await trackTaskWrite(async () => {
        try {
          await serverDelete()
        } catch (error) {
          mutate(currentTasks, { revalidate: false })
          throw error
        }
      })
    },
    [mutate]
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
