"use client"

import { FloatingTimer } from "@/components/timer/floating-timer"
import { usePrefetchData } from "@/hooks/use-prefetch"

interface DashboardClientProps {
  children: React.ReactNode
}

export function DashboardClient({ children }: DashboardClientProps) {
  // Prefetch common data in background when dashboard loads
  usePrefetchData()

  return (
    <>
      {children}
      {/* Timer saves worked time itself (see lib/timer-actions) */}
      <FloatingTimer />
    </>
  )
}
