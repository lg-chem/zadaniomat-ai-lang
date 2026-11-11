import { useEffect } from 'react'
import { preload } from 'swr'
import { fetcher } from '@/lib/swr-config'
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { localDayKey, quarterApiKey, quarterOf } from '@/lib/quarters'
import { habitsWeekKey } from '@/hooks/use-habits'
import { challengesKey } from '@/hooks/use-challenges'
import { sportActivitiesKey, stepsKey, weekRange } from '@/hooks/use-sport'

/**
 * Prefetches all common data for the current workspace
 * Call this once in the dashboard layout to preload data in the background
 */
export function usePrefetchData() {
  const { workspace } = useWorkspaceStore()

  useEffect(() => {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

    // Month range for calendar
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

    // Task counts range (7 days back, 30 days forward)
    const countsFrom = format(subDays(today, 7), 'yyyy-MM-dd')
    const countsTo = format(addDays(today, 30), 'yyyy-MM-dd')

    // Prefetch common data for WORK workspace
    if (workspace === 'WORK') {
      // Schedule page - today's tasks
      preload(`/api/tasks?workspace=WORK&date=${todayStr}`, fetcher)
      // Task counts for week strip
      preload(`/api/tasks/counts?workspace=WORK&from=${countsFrom}&to=${countsTo}`, fetcher)
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
      // Task counts for week strip
      preload(`/api/tasks/counts?workspace=PRIVATE&from=${countsFrom}&to=${countsTo}`, fetcher)
      // Categories
      preload(`/api/categories?workspace=PRIVATE`, fetcher)
      // Habits, challenges, sport and steps of this week - the same keys the pages
      // ("Dziś", Nawyki, Wyzwania, Sport) read, so they open with the data already there
      preload(habitsWeekKey(), fetcher)
      preload(challengesKey(), fetcher)
      preload(`/api/sport/types`, fetcher)
      preload(sportActivitiesKey(weekRange()), fetcher)
      preload(stepsKey(weekRange()), fetcher)
      // Plan of the day
      preload(`/api/schedule-blocks?workspace=PRIVATE&date=${todayStr}`, fetcher)
      // Knowledge categories
      preload(`/api/knowledge/categories?workspace=PRIVATE`, fetcher)
    }

    // Prefetch data for both workspaces (shared resources) - "Znajomi" has no knowledge base
    // (the request failed with an error on every page load there)
    if (workspace === 'WORK') {
      preload(`/api/knowledge/categories?workspace=WORK`, fetcher)
    }

  }, [workspace])
}

/**
 * Prefetch tasks and schedule blocks for adjacent days
 * Call this when user selects a date to preload nearby days
 */
// Workspaces with their own tasks - "FRIENDS" has none (requests for it fail)
const hasOwnData = (workspace: string) => workspace === 'WORK' || workspace === 'PRIVATE'

export function prefetchAdjacentDays(centerDate: Date, workspace: string) {
  if (!hasOwnData(workspace)) return
  const prevDay = format(subDays(centerDate, 1), 'yyyy-MM-dd')
  const nextDay = format(addDays(centerDate, 1), 'yyyy-MM-dd')

  // Prefetch tasks for adjacent days
  preload(`/api/tasks?workspace=${workspace}&date=${prevDay}&includeAssigned=true`, fetcher)
  preload(`/api/tasks?workspace=${workspace}&date=${nextDay}&includeAssigned=true`, fetcher)

  // Prefetch schedule blocks for adjacent days
  preload(`/api/schedule-blocks?workspace=${workspace}&date=${prevDay}`, fetcher)
  preload(`/api/schedule-blocks?workspace=${workspace}&date=${nextDay}`, fetcher)
}

/**
 * Prefetch data for a specific page (call on hover)
 */
export function prefetchPage(page: string, workspace: string = 'WORK') {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
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
      preload(quarterApiKey(quarterOf(localDayKey(today))), fetcher)
      preload(`/api/categories?workspace=${workspace}`, fetcher)
      break
    case 'backlog':
      preload(`/api/backlog?workspace=${workspace}&showProcessed=false`, fetcher)
      break
    case 'habits':
      preload(habitsWeekKey(), fetcher)
      break
    case 'challenges':
      preload(challengesKey(), fetcher)
      break
    case 'sport':
      preload(`/api/sport/types`, fetcher)
      preload(sportActivitiesKey(weekRange()), fetcher)
      preload(stepsKey(weekRange()), fetcher)
      break
    case 'today':
      preload(habitsWeekKey(), fetcher)
      preload(challengesKey(), fetcher)
      preload(sportActivitiesKey(weekRange()), fetcher)
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
