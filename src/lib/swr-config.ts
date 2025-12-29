import { SWRConfiguration } from 'swr'

// Simple fetcher - let SWR handle caching
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('An error occurred while fetching the data.')
  }
  return res.json()
}

// Global SWR configuration - optimized for performance
export const swrConfig: SWRConfiguration = {
  fetcher,
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
