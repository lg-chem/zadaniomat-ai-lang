import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Categories
export function useCategories(workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/categories?workspace=${workspace}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  )
  return { categories: data || [], isLoading, error, mutate }
}

// Sprints
export function useSprints(workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/sprints?workspace=${workspace}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )
  return { sprints: data || [], isLoading, error, mutate }
}

// Periods
export function usePeriods(workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/periods?workspace=${workspace}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )
  return { periods: data || [], isLoading, error, mutate }
}

// Tasks for a specific date
export function useTasks(date: string, workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    date ? `/api/tasks?date=${date}&workspace=${workspace}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds for tasks
    }
  )
  return { tasks: data || [], isLoading, error, mutate }
}

// Goals
export function useGoals(workspace: string = "WORK", sprintId?: string, periodId?: string) {
  let url = `/api/goals?workspace=${workspace}`
  if (sprintId) url += `&sprintId=${sprintId}`
  if (periodId) url += `&periodId=${periodId}`

  const { data, error, isLoading, mutate } = useSWR(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )
  return { goals: data || [], isLoading, error, mutate }
}

// Knowledge categories
export function useKnowledgeCategories(workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/knowledge/categories?workspace=${workspace}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )
  return {
    strategicCategories: data?.strategicCategories || [],
    customCategories: data?.customCategories || [],
    isLoading,
    error,
    mutate,
  }
}

// Knowledge entries
export function useKnowledgeEntries(categoryId: string | null, workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    categoryId ? `/api/knowledge/entries?categoryId=${categoryId}&workspace=${workspace}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )
  return { entries: data || [], isLoading, error, mutate }
}

// AI Conversations
export function useAIConversations(workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/ai/conversations?workspace=${workspace}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )
  return { conversations: data?.conversations || [], isLoading, error, mutate }
}

// AI Settings
export function useAISettings(workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/ai/settings?workspace=${workspace}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000, // 2 minutes for settings
    }
  )
  return {
    instructions: data?.instructions || {},
    isLoading,
    error,
    mutate,
  }
}

// Backlog items
export function useBacklog(workspace: string = "WORK") {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/backlog?workspace=${workspace}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )
  return { items: data || [], isLoading, error, mutate }
}

// Habits
export function useHabits() {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/habits`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )
  return { habits: data || [], isLoading, error, mutate }
}

// Challenges
export function useChallenges() {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/challenges`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )
  return { challenges: data || [], isLoading, error, mutate }
}

// Admin users
export function useAdminUsers() {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/users`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )
  return { users: data?.users || [], isLoading, error, mutate }
}
