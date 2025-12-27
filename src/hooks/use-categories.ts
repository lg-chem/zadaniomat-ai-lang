import useSWR from 'swr'
import { useWorkspaceStore } from '@/stores/workspace-store'

export interface Category {
  id: string
  name: string
  color: string
  icon?: string
  isStrategic: boolean
  order: number
}

export function useCategories() {
  const { workspace } = useWorkspaceStore()

  const { data, error, isLoading, mutate } = useSWR<Category[]>(
    `/api/categories?workspace=${workspace}`
  )

  return {
    categories: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
