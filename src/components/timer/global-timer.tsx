"use client"

import { useEffect } from "react"
import { Pause, Play, Square, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTimerStore } from "@/stores/timer-store"
import { cn } from "@/lib/utils"

interface GlobalTimerProps {
  onStop?: (taskId: string, duration: number) => void
}

export function GlobalTimer({ onStop }: GlobalTimerProps) {
  const {
    isRunning,
    isPaused,
    taskId,
    elapsedTime,
    pauseTimer,
    resumeTimer,
    stopTimer,
    tick,
  } = useTimerStore()

  useEffect(() => {
    if (!isRunning || isPaused) return

    const interval = setInterval(() => {
      tick()
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, isPaused, tick])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handlePause = () => {
    if (isPaused) {
      resumeTimer()
    } else {
      pauseTimer()
    }
  }

  const handleStop = () => {
    const result = stopTimer()
    if (result && onStop) {
      onStop(result.taskId, result.duration)
    }
  }

  if (!isRunning) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-card border shadow-lg">
        <Timer className={cn(
          "h-5 w-5",
          isPaused ? "text-muted-foreground" : "text-primary animate-pulse"
        )} />

        <span className={cn(
          "font-mono text-lg font-medium min-w-[80px]",
          isPaused ? "text-muted-foreground" : "text-foreground"
        )}>
          {formatTime(elapsedTime)}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePause}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={handleStop}
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
