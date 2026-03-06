"use client"

import { useCallback } from "react"
import { mutate } from "swr"
import { FloatingTimer } from "@/components/timer/floating-timer"
import { usePrefetchData } from "@/hooks/use-prefetch"

interface DashboardClientProps {
  children: React.ReactNode
}

export function DashboardClient({ children }: DashboardClientProps) {
  usePrefetchData()

  // Calculate total actualMinutes: base (from before timer) + timer elapsed
  // One ceil at the end → no rounding inflation
  const calcActualMinutes = (elapsedSeconds: number, baseActualMinutes: number) =>
    baseActualMinutes + Math.ceil(elapsedSeconds / 60)

  const handleTimerComplete = useCallback(async (taskId: string, elapsedSeconds: number, baseActualMinutes: number) => {
    const actualMinutes = calcActualMinutes(elapsedSeconds, baseActualMinutes)
    const durationMinutes = Math.ceil(elapsedSeconds / 60)

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          actualMinutes,
          completedAt: new Date().toISOString(),
        }),
      })

      if (durationMinutes > 0) {
        await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, duration: durationMinutes }),
        })
      }

      mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"))
    } catch (error) {
      console.error("Error completing task:", error)
    }
  }, [])

  const handleTimerStop = useCallback(async (taskId: string, elapsedSeconds: number, baseActualMinutes: number) => {
    const actualMinutes = calcActualMinutes(elapsedSeconds, baseActualMinutes)
    const durationMinutes = Math.ceil(elapsedSeconds / 60)

    try {
      // Overwrite actualMinutes with correct total (base + elapsed)
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualMinutes }),
      })

      if (durationMinutes > 0) {
        await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, duration: durationMinutes }),
        })
      }

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
