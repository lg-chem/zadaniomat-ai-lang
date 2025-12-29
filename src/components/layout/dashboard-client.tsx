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

  const handleTimerComplete = useCallback(async (taskId: string, duration: number) => {
    // Zapisz czas i ustaw status na COMPLETED
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          actualMinutes: duration,
          completedAt: new Date().toISOString(),
        }),
      })
      // Zapisz time entry
      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          duration,
        }),
      })
    } catch (error) {
      console.error("Error completing task:", error)
    }
  }, [])

  const handleTimerStop = useCallback(async (taskId: string, duration: number) => {
    // Zapisz czas ale nie zmieniaj statusu
    try {
      // Pobierz aktualny czas zadania
      const res = await fetch(`/api/tasks/${taskId}`)
      if (res.ok) {
        const task = await res.json()
        const newActualMinutes = (task.actualMinutes || 0) + duration

        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualMinutes: newActualMinutes,
          }),
        })
      }
      // Zapisz time entry
      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          duration,
        }),
      })
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
