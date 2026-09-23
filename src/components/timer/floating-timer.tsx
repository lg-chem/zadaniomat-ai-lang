"use client"

import { useEffect, useRef, useCallback } from "react"
import { Play, Pause, Square, Clock, Plus, Check, Minimize2, Maximize2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTimerStore, formatTime, useTimerHydration } from "@/stores/timer-store"
import { stopActiveTimer, completeActiveTimer } from "@/lib/timer-actions"
import { cn } from "@/lib/utils"

const EXTEND_OPTIONS = [5, 15, 30]

export function FloatingTimer() {
  // Wait for hydration to prevent timer flash on page load
  const isHydrated = useTimerHydration()

  const {
    isRunning,
    isPaused,
    isMinimized,
    position,
    taskTitle,
    plannedSeconds,
    baseSeconds,
    elapsedSeconds,
    showNotification,
    pauseTimer,
    resumeTimer,
    extendTimer,
    tick,
    dismissNotification,
    toggleMinimize,
    setPosition,
  } = useTimerStore()

  // Timer tick effect - only tick when running and not paused
  useEffect(() => {
    if (!isRunning || isPaused) return

    // Time is computed from the wall clock, so sync right away (e.g. after a reload)
    tick()
    const interval = setInterval(() => {
      tick()
    }, 1000)

    // Immediately sync when tab becomes visible again (browser throttles setInterval in background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isRunning, isPaused, tick])

  // Stop - worked time of this session is added to the task
  const handleStop = () => {
    stopActiveTimer()
  }

  // Complete - worked time is added and the task is marked as completed
  const handleComplete = () => {
    completeActiveTimer()
  }

  // Drag functionality
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return
    isDragging.current = true
    const rect = cardRef.current.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    const newX = e.clientX - dragOffset.current.x
    const newY = e.clientY - dragOffset.current.y
    // Clamp to viewport
    const maxX = window.innerWidth - (cardRef.current?.offsetWidth || 280)
    const maxY = window.innerHeight - (cardRef.current?.offsetHeight || 200)
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    })
  }, [setPosition])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Add/remove global mouse event listeners for drag
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Calculate position style
  const positionStyle = position
    ? { left: position.x, top: position.y, right: 'auto' }
    : { top: '5rem', right: '1rem' }

  // Don't render until hydration is complete and timer is actually running
  if (!isHydrated || !isRunning) return null

  // Main display counts up the whole time worked on the task
  const workedSeconds = baseSeconds + elapsedSeconds
  const hasPlan = plannedSeconds > 0
  const isOverPlan = hasPlan && workedSeconds >= plannedSeconds
  const progress = hasPlan ? Math.min(100, (workedSeconds / plannedSeconds) * 100) : 0
  const timeClassName = isOverPlan ? 'text-orange-500' : isPaused ? 'text-muted-foreground' : ''

  const pauseButton = isPaused ? (
    <Button size="sm" onClick={resumeTimer} className="flex-1">
      <Play className="h-4 w-4 mr-1" />
      Wznów
    </Button>
  ) : (
    <Button size="sm" variant="outline" onClick={pauseTimer} className="flex-1">
      <Pause className="h-4 w-4 mr-1" />
      Pauza
    </Button>
  )

  return (
    <>
      {/* Floating Timer Widget */}
      {isMinimized ? (
        // Minimized view - compact timer
        <Card
          ref={cardRef}
          className="fixed z-50 p-2 shadow-lg bg-background/95 backdrop-blur"
          style={positionStyle}
        >
          <div className="flex items-center gap-1">
            <div
              className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
              onMouseDown={handleMouseDown}
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <span className={cn("text-lg font-mono font-bold", timeClassName)}>
              {formatTime(workedSeconds)}
            </span>

            {isPaused ? (
              <Button size="icon" variant="ghost" onClick={resumeTimer} className="h-7 w-7" title="Wznów">
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" onClick={pauseTimer} className="h-7 w-7" title="Pauza">
                <Pause className="h-4 w-4" />
              </Button>
            )}

            <Button size="icon" variant="ghost" onClick={toggleMinimize} className="h-7 w-7">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        // Full view
        <Card
          ref={cardRef}
          className="fixed z-50 p-4 shadow-lg min-w-[280px] bg-background/95 backdrop-blur"
          style={positionStyle}
        >
          <div className="space-y-3">
            {/* Header with drag handle, title and minimize button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div
                  className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
                  onMouseDown={handleMouseDown}
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm truncate max-w-[160px]">
                  {taskTitle || "Zadanie"}
                </span>
              </div>
              <Button size="icon" variant="ghost" onClick={toggleMinimize} className="h-7 w-7">
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Timer display - time worked */}
            <div className="text-center">
              <span className={cn("text-3xl font-mono font-bold", timeClassName)}>
                {formatTime(workedSeconds)}
              </span>
              <div className="text-xs text-muted-foreground mt-1">
                {isPaused && "Pauza · "}
                {!hasPlan
                  ? "przepracowano"
                  : isOverPlan
                    ? <span className="text-orange-500 font-medium">+{formatTime(workedSeconds - plannedSeconds)} ponad plan ({formatTime(plannedSeconds)})</span>
                    : `zostało ${formatTime(plannedSeconds - workedSeconds)} z ${formatTime(plannedSeconds)}`}
              </div>
            </div>

            {/* Progress bar towards planned time */}
            {hasPlan && (
              <Progress value={progress} className={cn("h-2", isOverPlan && "[&>div]:bg-orange-500")} />
            )}

            {/* Only this session's time is added to the task on stop */}
            {baseSeconds > 0 && (
              <div className="text-xs text-muted-foreground text-center">
                Ta sesja: {formatTime(elapsedSeconds)}
              </div>
            )}

            {/* Extend planned time - timer keeps counting either way */}
            {hasPlan && (
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Przedłuż:</span>
                {EXTEND_OPTIONS.map((minutes) => (
                  <Button
                    key={minutes}
                    size="sm"
                    variant="ghost"
                    onClick={() => extendTimer(minutes)}
                    className="h-6 px-2 text-xs"
                  >
                    +{minutes}
                  </Button>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              {pauseButton}

              <Button size="sm" variant="destructive" onClick={handleStop} title="Zatrzymaj i zapisz czas">
                <Square className="h-4 w-4" />
              </Button>

              <Button size="sm" variant="default" onClick={handleComplete} title="Zakończ zadanie">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Planned time reached - timer keeps counting, closing this dialog just hides it */}
      <Dialog open={showNotification} onOpenChange={(open) => !open && dismissNotification()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Minął zaplanowany czas
            </DialogTitle>
            <DialogDescription>
              Zadanie &quot;{taskTitle}&quot; - przepracowano{" "}
              <strong>{formatTime(workedSeconds)}</strong> (plan: {formatTime(plannedSeconds)}).
              <br />
              Timer liczy dalej - możesz przedłużyć plan, pracować dalej albo zakończyć.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Extension options */}
            <div className="grid grid-cols-3 gap-2">
              {EXTEND_OPTIONS.map((minutes) => (
                <Button
                  key={minutes}
                  variant="outline"
                  onClick={() => extendTimer(minutes)}
                  className="flex flex-col h-auto py-3"
                >
                  <Plus className="h-4 w-4 mb-1" />
                  <span className="text-sm">+{minutes} min</span>
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={dismissNotification} className="flex-1">
              Pracuj dalej
            </Button>
            <Button variant="outline" onClick={handleStop} className="flex-1">
              <Square className="h-4 w-4 mr-2" />
              Zatrzymaj i zapisz
            </Button>
            <Button onClick={handleComplete} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Zakończ zadanie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
