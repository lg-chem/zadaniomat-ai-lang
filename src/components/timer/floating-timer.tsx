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

interface FloatingTimerProps {
  onComplete?: (taskId: string, durationSeconds: number) => void
  onStop?: (taskId: string, durationSeconds: number) => void
}

export function FloatingTimer({ onComplete, onStop }: FloatingTimerProps) {
  // Wait for hydration to prevent timer flash on page load
  const isHydrated = useTimerHydration()

  const {
    isRunning,
    isPaused,
    isMinimized,
    position,
    taskId,
    taskTitle,
    mode,
    plannedSeconds,
    elapsedSeconds,
    remainingSeconds,
    isTimeUp,
    showNotification,
    pendingStart,
    pauseTimer,
    resumeTimer,
    extendTimer,
    stopTimer,
    completeTask,
    tick,
    dismissNotification,
    confirmPendingStart,
    cancelPendingStart,
    toggleMinimize,
    setPosition,
  } = useTimerStore()

  // Timer tick effect - only tick when running and not paused
  useEffect(() => {
    if (!isRunning || isPaused) return

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

  // Handle stop
  const handleStop = () => {
    const result = stopTimer()
    if (result && onStop) {
      onStop(result.taskId, result.durationSeconds)
    }
  }

  // Handle complete
  const handleComplete = () => {
    const result = completeTask()
    if (result && onComplete) {
      onComplete(result.taskId, result.durationSeconds)
    }
  }

  // Handle extend
  const handleExtend = (minutes: number) => {
    extendTimer(minutes)
    dismissNotification()
  }

  // Handle pending start confirmation
  const handleConfirmPendingStart = (minutes: number) => {
    confirmPendingStart(minutes)
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

  // Show pending start dialog even if timer is not running
  if (isHydrated && pendingStart) {
    return (
      <Dialog open={true} onOpenChange={() => cancelPendingStart()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Przekroczono zaplanowany czas
            </DialogTitle>
            <DialogDescription>
              Zadanie &quot;{pendingStart.taskTitle}&quot; miało zaplanowane{" "}
              <strong>{pendingStart.plannedMinutes} min</strong>, ale przepracowano już{" "}
              <strong>{pendingStart.alreadyWorkedMinutes} min</strong>.
              <br /><br />
              Ile dodatkowych minut chcesz uruchomić?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => handleConfirmPendingStart(5)}
                className="flex flex-col h-auto py-3"
              >
                <Plus className="h-4 w-4 mb-1" />
                <span className="text-sm">5 min</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfirmPendingStart(15)}
                className="flex flex-col h-auto py-3"
              >
                <Plus className="h-4 w-4 mb-1" />
                <span className="text-sm">15 min</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfirmPendingStart(30)}
                className="flex flex-col h-auto py-3"
              >
                <Plus className="h-4 w-4 mb-1" />
                <span className="text-sm">30 min</span>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => cancelPendingStart()}>
              Anuluj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Don't render until hydration is complete and timer is actually running
  if (!isHydrated || !isRunning) return null

  // Calculate progress percentage
  const progress = mode === 'countdown' && plannedSeconds > 0
    ? ((plannedSeconds - remainingSeconds) / plannedSeconds) * 100
    : 0

  // Display time based on mode
  const displayTime = mode === 'countdown' ? remainingSeconds : elapsedSeconds

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
            <span className={`text-lg font-mono font-bold ${isTimeUp ? 'text-destructive animate-pulse' : ''}`}>
              {formatTime(displayTime)}
            </span>

            {isPaused && !isTimeUp ? (
              <Button size="icon" variant="ghost" onClick={resumeTimer} className="h-7 w-7">
                <Play className="h-4 w-4" />
              </Button>
            ) : !isTimeUp ? (
              <Button size="icon" variant="ghost" onClick={pauseTimer} className="h-7 w-7">
                <Pause className="h-4 w-4" />
              </Button>
            ) : null}

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

            {/* Timer display */}
            <div className="text-center">
              <span className={`text-3xl font-mono font-bold ${isTimeUp ? 'text-destructive animate-pulse' : ''}`}>
                {formatTime(displayTime)}
              </span>
              {mode === 'countdown' && plannedSeconds > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  z {formatTime(plannedSeconds)} planowanych
                </div>
              )}
            </div>

            {/* Progress bar (only for countdown) */}
            {mode === 'countdown' && plannedSeconds > 0 && (
              <Progress value={progress} className="h-2" />
            )}

            {/* Elapsed time info */}
            <div className="text-xs text-muted-foreground text-center">
              Przepracowano: {formatTime(elapsedSeconds)}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              {isPaused && !isTimeUp ? (
                <Button size="sm" onClick={resumeTimer} className="flex-1">
                  <Play className="h-4 w-4 mr-1" />
                  Wznów
                </Button>
              ) : !isTimeUp ? (
                <Button size="sm" variant="outline" onClick={pauseTimer} className="flex-1">
                  <Pause className="h-4 w-4 mr-1" />
                  Pauza
                </Button>
              ) : null}

              <Button size="sm" variant="destructive" onClick={handleStop}>
                <Square className="h-4 w-4" />
              </Button>

              <Button size="sm" variant="default" onClick={handleComplete}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Time Up Notification Dialog */}
      <Dialog open={showNotification} onOpenChange={dismissNotification}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Czas minął!
            </DialogTitle>
            <DialogDescription>
              Planowany czas na zadanie &quot;{taskTitle}&quot; dobiegł końca.
              <br />
              Przepracowano: <strong>{formatTime(elapsedSeconds)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Co chcesz zrobić?
            </p>

            {/* Extension options */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => handleExtend(5)}
                className="flex flex-col h-auto py-3"
              >
                <Plus className="h-4 w-4 mb-1" />
                <span className="text-sm">+5 min</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExtend(15)}
                className="flex flex-col h-auto py-3"
              >
                <Plus className="h-4 w-4 mb-1" />
                <span className="text-sm">+15 min</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExtend(30)}
                className="flex flex-col h-auto py-3"
              >
                <Plus className="h-4 w-4 mb-1" />
                <span className="text-sm">+30 min</span>
              </Button>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleStop} className="flex-1">
              <Square className="h-4 w-4 mr-2" />
              Zatrzymaj timer
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
