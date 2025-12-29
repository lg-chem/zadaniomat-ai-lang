import { useEffect } from 'react'
import { preload } from 'swr'
import { fetcher } from '@/lib/swr-config'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { useWorkspaceStore } from '@/stores/workspace-store'

/**
 * Prefetches all common data for the current workspace
 * Call this once in the dashboard layout to preload data in the background
 */
export function usePrefetchData() {
  const { workspace } = useWorkspaceStore()

  useEffect(() => {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

    // Week range for calendar
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')

    // Month range for calendar
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

    // Prefetch common data for WORK workspace
    if (workspace === 'WORK') {
      // Schedule page - today's tasks
      preload(`/api/tasks?workspace=WORK&date=${todayStr}`, fetcher)
      // Categories
      preload(`/api/categories?workspace=WORK`, fetcher)
      // Goals
      preload(`/api/goals?workspace=WORK`, fetcher)
      // Periods & Sprints
      preload(`/api/periods?workspace=WORK`, fetcher)
      // Calendar - month tasks
      preload(`/api/tasks?workspace=WORK&from=${monthStart}&to=${monthEnd}`, fetcher)
      // Backlog
      preload(`/api/backlog?workspace=WORK&showProcessed=false`, fetcher)
    }

    // Prefetch common data for PRIVATE workspace
    if (workspace === 'PRIVATE') {
      // Schedule page - today's tasks
      preload(`/api/tasks?workspace=PRIVATE&date=${todayStr}`, fetcher)
      // Categories
      preload(`/api/categories?workspace=PRIVATE`, fetcher)
      // Habits
      preload(`/api/habits`, fetcher)
      // Challenges
      preload(`/api/challenges?showCompleted=false`, fetcher)
      // Sport types
      preload(`/api/sport/types`, fetcher)
      // Sport activities for week
      preload(`/api/sport/activities?from=${weekStart}&to=${weekEnd}`, fetcher)
      // Steps for week
      preload(`/api/sport/steps?from=${weekStart}&to=${weekEnd}`, fetcher)
      // Knowledge categories
      preload(`/api/knowledge/categories?workspace=PRIVATE`, fetcher)
    }

    // Prefetch data for both workspaces (shared resources)
    preload(`/api/knowledge/categories?workspace=${workspace}`, fetcher)

  }, [workspace])
}

/**
 * Prefetch data for a specific page (call on hover)
 */
export function prefetchPage(page: string, workspace: string = 'WORK') {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

  switch (page) {
    case 'schedule':
      preload(`/api/tasks?workspace=${workspace}&date=${todayStr}`, fetcher)
      preload(`/api/categories?workspace=${workspace}`, fetcher)
      break
    case 'calendar':
      preload(`/api/tasks?workspace=${workspace}&from=${monthStart}&to=${monthEnd}`, fetcher)
      break
    case 'goals':
      preload(`/api/goals?workspace=${workspace}`, fetcher)
      preload(`/api/categories?workspace=${workspace}`, fetcher)
      preload(`/api/periods?workspace=${workspace}`, fetcher)
      break
    case 'sprints':
      preload(`/api/periods?workspace=${workspace}`, fetcher)
      break
    case 'backlog':
      preload(`/api/backlog?workspace=${workspace}&showProcessed=false`, fetcher)
      break
    case 'habits':
      preload(`/api/habits`, fetcher)
      break
    case 'challenges':
      preload(`/api/challenges?showCompleted=false`, fetcher)
      break
    case 'sport':
      preload(`/api/sport/types`, fetcher)
      preload(`/api/sport/activities?from=${weekStart}&to=${weekEnd}`, fetcher)
      preload(`/api/sport/steps?from=${weekStart}&to=${weekEnd}`, fetcher)
      break
    case 'knowledge':
      preload(`/api/knowledge/categories?workspace=${workspace}`, fetcher)
      preload(`/api/knowledge/entries?workspace=${workspace}`, fetcher)
      break
    case 'stats':
      preload(`/api/tasks?workspace=${workspace}&from=${weekStart}&to=${todayStr}`, fetcher)
      preload(`/api/goals?workspace=${workspace}`, fetcher)
      break
  }
}
