import { useSyncExternalStore } from 'react'
import type { Middleware, SWRConfiguration } from 'swr'

// Simple fetcher - let SWR handle caching
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('An error occurred while fetching the data.')
  }
  return res.json()
}

const subscribeNothing = () => () => {}

// Data is fetched once the page has taken over from the server-rendered HTML.
// In that first render the stores still show their defaults (the workspace is
// "FRIENDS" until the saved one is read), so every list was first requested for
// the wrong workspace - a burst of failing, retried requests on each app start.
const afterHydration: Middleware = (useSWRNext) => (key, fetcher, config) => {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false)
  return useSWRNext(hydrated ? key : null, fetcher, config)
}

// Global SWR configuration - optimized for performance
export const swrConfig: SWRConfiguration = {
  fetcher,
  use: [afterHydration],
  // Don't revalidate on window focus - prevents unnecessary requests when switching tabs
  revalidateOnFocus: false,
  // Revalidate on reconnect
  revalidateOnReconnect: true,
  // Dedupe requests within 5 seconds (prevents duplicate requests)
  dedupingInterval: 5000,
  // Retry on error
  errorRetryCount: 2,
  errorRetryInterval: 3000,
  // Keep previous data while revalidating - smoother UX (no loading flash)
  keepPreviousData: true,
  // Revalidate stale data - ensures mutations work properly
  revalidateIfStale: true,
  // Disable automatic revalidation interval
  refreshInterval: 0,
}
