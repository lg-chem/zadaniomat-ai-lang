"use client"

import { useCallback } from "react"
import { mutate } from "swr"
import { FloatingTimer } from "@/components/timer/floating-timer"
import { usePrefetchData } from "@/hooks/use-prefetch"

interface DashboardClientProps {
  children: React.ReactNode
}

export function DashboardClient({ children }: DashboardClientProps) {
  // Prefetch common data in background when dashboard loads
  usePrefetchData()

  const handleTimerComplete = useCallback(async (taskId: string, durationSeconds: number, sessionDurationSeconds: number) => {
    // sessionDurationSeconds = time worked in THIS session only
    // durationSeconds = total elapsed across all timer sessions in this chain
    const sessionMinutes = Math.ceil(sessionDurationSeconds / 60)

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          actualMinutesIncrement: sessionMinutes,
          completedAt: new Date().toISOString(),
        }),
      })

      // Save time entry for this session only
      if (sessionMinutes > 0) {
        await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            duration: sessionMinutes,
          }),
        })
      }

      // Refresh tasks data so UI updates immediately
      mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"))
    } catch (error) {
      console.error("Error completing task:", error)
    }
  }, [])

  const handleTimerStop = useCallback(async (taskId: string, durationSeconds: number, sessionDurationSeconds: number) => {
    // sessionDurationSeconds = time worked in THIS session only
    const sessionMinutes = Math.ceil(sessionDurationSeconds / 60)

    try {
      // Increment actualMinutes by session time (not overwrite!)
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualMinutesIncrement: sessionMinutes,
        }),
      })

      // Save time entry for this session only
      if (sessionMinutes > 0) {
        await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            duration: sessionMinutes,
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
    </>
  )
}
