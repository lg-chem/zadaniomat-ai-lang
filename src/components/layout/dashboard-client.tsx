"use client"

import { useCallback } from "react"
import { mutate } from "swr"
import { FloatingTimer } from "@/components/timer/floating-timer"
import { BacklogQuickAddBubble } from "@/components/backlog/quick-add-bubble"
import { usePrefetchData } from "@/hooks/use-prefetch"

interface DashboardClientProps {
  children: React.ReactNode
}

export function DashboardClient({ children }: DashboardClientProps) {
  // Prefetch common data in background when dashboard loads
  usePrefetchData()

  const handleTimerComplete = useCallback(async (taskId: string, durationSeconds: number) => {
    // durationSeconds is the TOTAL elapsed time (accumulated across all sessions)
    // Round only once at final save
    const durationMinutes = Math.ceil(durationSeconds / 60)

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          actualMinutes: durationMinutes,
          completedAt: new Date().toISOString(),
        }),
      })

      // Save time entry
      if (durationMinutes > 0) {
        await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            duration: durationMinutes,
          }),
        })
      }

      // Refresh tasks data so UI updates immediately
      mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"))
    } catch (error) {
      console.error("Error completing task:", error)
    }
  }, [])

  const handleTimerStop = useCallback(async (taskId: string, durationSeconds: number) => {
    // durationSeconds is the TOTAL elapsed time (accumulated across all sessions)
    // Round only once and save to actualMinutes
    const durationMinutes = Math.ceil(durationSeconds / 60)

    try {
      // Update actualMinutes with total time (not adding to existing!)
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualMinutes: durationMinutes,
        }),
      })

      // Save time entry for this session
      if (durationMinutes > 0) {
        await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            duration: durationMinutes,
          }),
        })
      }

      // Refresh tasks data so UI updates immediately
      mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"))
    } catch (error) {
      console.error("Error saving time:", error)
    }
  }, [])

  return (
    <>
      {children}
      <FloatingTimer
        onComplete={handleTimerComplete}
        onStop={handleTimerStop}
      />
      <BacklogQuickAddBubble />
    </>
  )
}
