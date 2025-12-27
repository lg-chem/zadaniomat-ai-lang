"use client"

import { useEffect } from "react"
import { Play, Pause, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTimerStore } from "@/stores/timer-store"
import { cn } from "@/lib/utils"

interface TaskTimerProps {
  taskId: string
  taskTitle?: string
  onStop?: (duration: number) => void
  compact?: boolean
}

export function TaskTimer({ taskId, taskTitle, onStop, compact = false }: TaskTimerProps) {
  const {
    isRunning,
    isPaused,
    taskId: activeTaskId,
    elapsedTime,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    tick,
  } = useTimerStore()

  const isActive = activeTaskId === taskId

  // Timer tick
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

  const handleStart = () => {
    if (isRunning && activeTaskId !== taskId) {
      // Stop current timer first
      const result = stopTimer()
      if (result && onStop) {
        onStop(result.duration)
      }
    }
    startTimer(taskId)
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
      onStop(result.duration)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isActive ? (
          <>
            <span className={cn(
              "font-mono text-sm",
              isPaused ? "text-muted-foreground" : "text-foreground"
            )}>
              {formatTime(elapsedTime)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePause}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={handleStop}
            >
              <Square className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleStart}
            disabled={isRunning && activeTaskId !== taskId}
          >
            <Play className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-card border">
      {taskTitle && (
        <p className="text-sm text-muted-foreground text-center truncate max-w-full">
          {taskTitle}
        </p>
      )}

      <div className={cn(
        "text-4xl font-mono font-bold",
        isActive && !isPaused ? "text-primary" : "text-muted-foreground"
      )}>
        {isActive ? formatTime(elapsedTime) : "0:00"}
      </div>

      <div className="flex items-center gap-2">
        {isActive ? (
          <>
            <Button
              variant={isPaused ? "default" : "secondary"}
              size="lg"
              onClick={handlePause}
            >
              {isPaused ? (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Wznów
                </>
              ) : (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Pauza
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={handleStop}
            >
              <Square className="h-5 w-5 mr-2" />
              Stop
            </Button>
          </>
        ) : (
          <Button
            size="lg"
            onClick={handleStart}
            disabled={isRunning}
          >
            <Play className="h-5 w-5 mr-2" />
            Start
          </Button>
        )}
      </div>
    </div>
  )
}
