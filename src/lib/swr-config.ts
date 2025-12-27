import { SWRConfiguration } from 'swr'

// Global fetcher function
export const fetcher = async (url: string) => {
  const res = await fetch(url)

  // Handle errors
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }

  return res.json()
}

// Global SWR configuration
export const swrConfig: SWRConfiguration = {
  fetcher,
  // Revalidate on focus
  revalidateOnFocus: false,
  // Revalidate on reconnect
  revalidateOnReconnect: true,
  // Dedupe requests within 2 seconds
  dedupingInterval: 2000,
  // Cache data for 5 minutes
  focusThrottleInterval: 5000,
  // Retry on error
  errorRetryCount: 2,
  errorRetryInterval: 5000,
  // Keep previous data while revalidating
  keepPreviousData: true,
}
