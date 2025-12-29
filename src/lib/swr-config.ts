import { SWRConfiguration } from 'swr'

// Cache for storing fetched data
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minute cache

// Global fetcher function with request deduplication
const pendingRequests = new Map<string, Promise<unknown>>()

export const fetcher = async (url: string) => {
  // Check cache first
  const cached = cache.get(url)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // Dedupe concurrent requests
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)
  }

  const fetchPromise = fetch(url).then(async (res) => {
    if (!res.ok) {
      throw new Error('An error occurred while fetching the data.')
    }
    const data = await res.json()
    cache.set(url, { data, timestamp: Date.now() })
    pendingRequests.delete(url)
    return data
  }).catch((err) => {
    pendingRequests.delete(url)
    throw err
  })

  pendingRequests.set(url, fetchPromise)
  return fetchPromise
}

// Clear cache for a specific URL or all
export const clearCache = (url?: string) => {
  if (url) {
    cache.delete(url)
  } else {
    cache.clear()
  }
}

// Global SWR configuration - optimized for performance
export const swrConfig: SWRConfiguration = {
  fetcher,
  // Don't revalidate on focus - prevents unnecessary requests
  revalidateOnFocus: false,
  // Revalidate on reconnect
  revalidateOnReconnect: true,
  // Dedupe requests within 60 seconds
  dedupingInterval: 60000,
  // Throttle focus revalidation
  focusThrottleInterval: 60000,
  // Retry on error
  errorRetryCount: 2,
  errorRetryInterval: 5000,
  // Keep previous data while revalidating - smoother UX
  keepPreviousData: true,
  // Don't revalidate on mount if data exists - faster initial render
  revalidateIfStale: false,
  // Disable automatic revalidation interval
  refreshInterval: 0,
}
