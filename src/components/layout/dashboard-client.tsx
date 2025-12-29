"use client"

import { useCallback } from "react"
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
    // Round only once at final save
    const durationMinutes = Math.ceil(durationSeconds / 60)

    // Zapisz czas i ustaw status na COMPLETED
    try {
      // Pobierz aktualny czas zadania i dodaj nowy
      const res = await fetch(`/api/tasks/${taskId}`)
      let totalMinutes = durationMinutes
      if (res.ok) {
        const task = await res.json()
        totalMinutes = (task.actualMinutes || 0) + durationMinutes
      }

      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          actualMinutes: totalMinutes,
          completedAt: new Date().toISOString(),
        }),
      })
      // Zapisz time entry
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
    } catch (error) {
      console.error("Error completing task:", error)
    }
  }, [])

  const handleTimerStop = useCallback(async (taskId: string, durationSeconds: number) => {
    // Don't update actualMinutes on stop - only on complete
    // This prevents rounding multiple times (e.g., 3x10sec = 3min instead of 1min)
    // Time is saved in localStorage (taskTimeStates) and will be counted when task is completed

    // Only save time entry if significant time passed (at least 1 minute)
    const durationMinutes = Math.ceil(durationSeconds / 60)
    if (durationMinutes > 0) {
      try {
        await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            duration: durationMinutes,
          }),
        })
      } catch (error) {
        console.error("Error saving time entry:", error)
      }
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
