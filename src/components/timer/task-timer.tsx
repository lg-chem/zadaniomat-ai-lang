"use client"

import { useEffect } from "react"
import { Play, Pause, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTimerStore, formatTime } from "@/stores/timer-store"
import { cn } from "@/lib/utils"

interface TaskTimerProps {
  taskId: string
  taskTitle?: string
  plannedMinutes?: number
  onStop?: (duration: number) => void
  compact?: boolean
}

export function TaskTimer({ taskId, taskTitle, plannedMinutes, onStop, compact = false }: TaskTimerProps) {
  const {
    isRunning,
    isPaused,
    taskId: activeTaskId,
    elapsedSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    tick,
  } = useTimerStore()

  const isActive = activeTaskId === taskId

  // Note: Timer tick is handled by FloatingTimer only to avoid double counting

  const handleStart = () => {
    if (isRunning && activeTaskId !== taskId) {
      // Stop current timer first
      const result = stopTimer()
      if (result && onStop) {
        onStop(result.duration)
      }
    }
    startTimer(taskId, taskTitle || "Zadanie", plannedMinutes)
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
              {formatTime(elapsedSeconds)}
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
        {isActive ? formatTime(elapsedSeconds) : "0:00"}
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
