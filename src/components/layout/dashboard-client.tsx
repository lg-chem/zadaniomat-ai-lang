"use client"

import { useEffect } from "react"
import { mutate } from "swr"
import { FloatingTimer } from "@/components/timer/floating-timer"
import { usePrefetchData } from "@/hooks/use-prefetch"
import { startNoteSync } from "@/lib/note-outbox"

interface DashboardClientProps {
  children: React.ReactNode
}

export function DashboardClient({ children }: DashboardClientProps) {
  // Prefetch common data in background when dashboard loads
  usePrefetchData()

  // Notes written without internet are sent from any page once it's back
  useEffect(() => startNoteSync((isNotesKey) => mutate(isNotesKey)), [])

  return (
    <>
      {children}
      {/* Timer saves worked time itself (see lib/timer-actions) */}
      <FloatingTimer />
    </>
  )
}
