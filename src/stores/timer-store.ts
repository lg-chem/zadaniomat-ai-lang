import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useState } from 'react'

export type TimerMode = 'countdown' | 'stopwatch'

interface TaskTimeState {
  remainingSeconds: number
  elapsedSeconds: number
}

interface TimerState {
  // Core state
  isRunning: boolean
  isPaused: boolean
  isMinimized: boolean
  position: { x: number; y: number } | null  // null = default position (top-right)
  taskId: string | null
  taskTitle: string | null

  // Time tracking
  mode: TimerMode
  plannedSeconds: number      // Planowany czas w sekundach
  elapsedSeconds: number      // Całkowity czas, który upłynął
  remainingSeconds: number    // Pozostały czas (dla countdown)

  // Session tracking
  sessionStartTime: Date | null
  accumulatedSeconds: number  // Czas zapisany przed pauzą

  // Notification state
  isTimeUp: boolean           // Czy czas się skończył
  showNotification: boolean   // Czy pokazać powiadomienie

  // Per-task time tracking (remembers where user left off)
  taskTimeStates: Record<string, TaskTimeState>

  // Pending start (when we need to show extend dialog first)
  pendingStart: {
    taskId: string
    taskTitle: string
    plannedMinutes: number
    alreadyWorkedMinutes: number
  } | null

  // Actions
  startTimer: (taskId: string, taskTitle: string, plannedMinutes?: number, alreadyWorkedMinutes?: number) => void
  pauseTimer: () => void
  resumeTimer: () => void
  extendTimer: (minutes: number) => void
  stopTimer: () => { taskId: string; durationSeconds: number } | null
  completeTask: () => { taskId: string; durationSeconds: number } | null
  tick: () => void
  dismissNotification: () => void
  reset: () => void
  // New actions
  setPendingStart: (taskId: string, taskTitle: string, plannedMinutes: number, alreadyWorkedMinutes: number) => void
  confirmPendingStart: (additionalMinutes: number) => void
  cancelPendingStart: () => void
  clearTaskTimeState: (taskId: string) => void
  toggleMinimize: () => void
  setPosition: (position: { x: number; y: number } | null) => void
}

// Helper to request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

// Helper to show browser notification
const showBrowserNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'timer-notification',
      requireInteraction: true,
    })
  }
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      // Initial state
      isRunning: false,
      isPaused: false,
      isMinimized: false,
      position: null,
      taskId: null,
      taskTitle: null,
      mode: 'countdown',
      plannedSeconds: 0,
      elapsedSeconds: 0,
      remainingSeconds: 0,
      sessionStartTime: null,
      accumulatedSeconds: 0,
      isTimeUp: false,
      showNotification: false,
      taskTimeStates: {},
      pendingStart: null,

      startTimer: (taskId, taskTitle, plannedMinutes, alreadyWorkedMinutes = 0) => {
        requestNotificationPermission()

        const { taskTimeStates } = get()
        const savedState = taskTimeStates[taskId]

        // Check if task already exceeded planned time
        if (plannedMinutes && alreadyWorkedMinutes >= plannedMinutes) {
          // Need to ask user how much additional time
          set({
            pendingStart: {
              taskId,
              taskTitle,
              plannedMinutes,
              alreadyWorkedMinutes,
            }
          })
          return
        }

        let initialElapsed = 0
        let initialRemaining = plannedMinutes ? plannedMinutes * 60 : 0

        // If we have saved state for this task, resume from there
        if (savedState) {
          initialElapsed = savedState.elapsedSeconds
          initialRemaining = savedState.remainingSeconds
        }

        const mode: TimerMode = plannedMinutes ? 'countdown' : 'stopwatch'

        set({
          isRunning: true,
          isPaused: false,
          taskId,
          taskTitle,
          mode,
          plannedSeconds: plannedMinutes ? plannedMinutes * 60 : 0,
          elapsedSeconds: initialElapsed,
          remainingSeconds: initialRemaining,
          sessionStartTime: new Date(),
          accumulatedSeconds: initialElapsed,
          isTimeUp: false,
          showNotification: false,
          pendingStart: null,
        })
      },

      setPendingStart: (taskId, taskTitle, plannedMinutes, alreadyWorkedMinutes) => {
        set({
          pendingStart: {
            taskId,
            taskTitle,
            plannedMinutes,
            alreadyWorkedMinutes,
          }
        })
      },

      confirmPendingStart: (additionalMinutes) => {
        const { pendingStart, taskTimeStates } = get()
        if (!pendingStart) return

        requestNotificationPermission()

        // Check if there's saved state from a previous session (user stopped but didn't complete)
        const savedState = taskTimeStates[pendingStart.taskId]
        const previousElapsed = savedState?.elapsedSeconds || 0
        const additionalSeconds = additionalMinutes * 60

        console.log('[confirmPendingStart] State:', {
          taskId: pendingStart.taskId,
          savedState,
          previousElapsed,
          additionalMinutes,
          allTaskTimeStates: taskTimeStates
        })

        // Clear saved state since we're resuming
        const newTaskTimeStates = { ...taskTimeStates }
        delete newTaskTimeStates[pendingStart.taskId]

        set({
          isRunning: true,
          isPaused: false,
          taskId: pendingStart.taskId,
          taskTitle: pendingStart.taskTitle,
          mode: 'countdown',
          // plannedSeconds = previous elapsed + new time, so tick() calculates remaining correctly
          plannedSeconds: previousElapsed + additionalSeconds,
          elapsedSeconds: previousElapsed,
          remainingSeconds: additionalSeconds,
          sessionStartTime: new Date(),
          accumulatedSeconds: previousElapsed,
          isTimeUp: false,
          showNotification: false,
          pendingStart: null,
          taskTimeStates: newTaskTimeStates,
        })
      },

      cancelPendingStart: () => {
        set({ pendingStart: null })
      },

      clearTaskTimeState: (taskId) => {
        const { taskTimeStates } = get()
        const newTaskTimeStates = { ...taskTimeStates }
        delete newTaskTimeStates[taskId]
        set({ taskTimeStates: newTaskTimeStates })
      },

      toggleMinimize: () => {
        set((state) => ({ isMinimized: !state.isMinimized }))
      },

      setPosition: (position) => {
        set({ position })
      },

      pauseTimer: () => {
        const { isRunning, isPaused, elapsedSeconds, accumulatedSeconds } = get()
        if (isRunning && !isPaused) {
          set({
            isPaused: true,
            accumulatedSeconds: accumulatedSeconds + (elapsedSeconds - accumulatedSeconds),
            sessionStartTime: null,
          })
        }
      },

      resumeTimer: () => {
        const { isRunning, isPaused, isTimeUp } = get()
        if (isRunning && isPaused && !isTimeUp) {
          set({
            isPaused: false,
            sessionStartTime: new Date(),
          })
        }
      },

      extendTimer: (minutes) => {
        const { remainingSeconds, elapsedSeconds, accumulatedSeconds: oldAccumulated } = get()
        const additionalSeconds = minutes * 60

        console.log('[extendTimer] Before:', {
          elapsedSeconds,
          remainingSeconds,
          oldAccumulated,
          minutes,
          additionalSeconds
        })

        set({
          remainingSeconds: remainingSeconds + additionalSeconds,
          plannedSeconds: get().plannedSeconds + additionalSeconds,
          isTimeUp: false,
          showNotification: false,
          isPaused: false,
          sessionStartTime: new Date(),
          accumulatedSeconds: elapsedSeconds, // Sync accumulated with elapsed before resuming
        })

        console.log('[extendTimer] After:', {
          newAccumulated: elapsedSeconds,
          newRemaining: remainingSeconds + additionalSeconds
        })
      },

      stopTimer: () => {
        const { taskId, elapsedSeconds, remainingSeconds, isRunning, taskTimeStates } = get()
        if (!isRunning || !taskId) return null

        // Return seconds - rounding should happen only once at final save
        const durationSeconds = elapsedSeconds

        console.log('[stopTimer] Saving state:', {
          taskId,
          elapsedSeconds,
          remainingSeconds,
          durationSeconds
        })

        // Save state for this task so we can resume later
        const newTaskTimeStates = {
          ...taskTimeStates,
          [taskId]: {
            elapsedSeconds,
            remainingSeconds,
          }
        }

        set({
          isRunning: false,
          isPaused: false,
          taskId: null,
          taskTitle: null,
          mode: 'countdown',
          plannedSeconds: 0,
          elapsedSeconds: 0,
          remainingSeconds: 0,
          sessionStartTime: null,
          accumulatedSeconds: 0,
          isTimeUp: false,
          showNotification: false,
          taskTimeStates: newTaskTimeStates,
        })

        return { taskId, durationSeconds }
      },

      completeTask: () => {
        const { taskId, taskTimeStates } = get()
        const result = get().stopTimer()

        // Clear saved state for completed task (no need to resume)
        if (taskId) {
          const newTaskTimeStates = { ...taskTimeStates }
          delete newTaskTimeStates[taskId]
          set({ taskTimeStates: newTaskTimeStates })
        }

        return result
      },

      tick: () => {
        const { isRunning, isPaused, sessionStartTime, accumulatedSeconds, remainingSeconds, mode, isTimeUp, taskTitle, plannedSeconds } = get()

        if (!isRunning || isPaused || !sessionStartTime) return

        // Calculate real elapsed time based on wall clock (not setInterval ticks)
        const now = new Date()
        const sessionSeconds = Math.floor((now.getTime() - new Date(sessionStartTime).getTime()) / 1000)
        const newElapsedSeconds = accumulatedSeconds + sessionSeconds

        if (mode === 'countdown') {
          // Calculate remaining based on planned time minus elapsed
          const totalElapsed = newElapsedSeconds
          const newRemainingSeconds = Math.max(0, plannedSeconds - totalElapsed)

          // Sprawdź czy czas się skończył
          if (newRemainingSeconds === 0 && !isTimeUp) {
            showBrowserNotification(
              '⏰ Czas minął!',
              `Zadanie "${taskTitle}" - czas się skończył. Przedłuż lub zakończ.`
            )

            // Save state to taskTimeStates so it can be recovered if user closes dialog
            const { taskId, taskTimeStates } = get()
            const newTaskTimeStates = taskId ? {
              ...taskTimeStates,
              [taskId]: {
                elapsedSeconds: newElapsedSeconds,
                remainingSeconds: 0,
              }
            } : taskTimeStates

            set({
              elapsedSeconds: newElapsedSeconds,
              remainingSeconds: 0,
              isTimeUp: true,
              showNotification: true,
              isPaused: true, // Auto-pauza po zakończeniu czasu
              taskTimeStates: newTaskTimeStates,
            })
          } else {
            set({
              elapsedSeconds: newElapsedSeconds,
              remainingSeconds: newRemainingSeconds,
            })
          }
        } else {
          // Stopwatch mode - just count up
          set({ elapsedSeconds: newElapsedSeconds })
        }
      },

      dismissNotification: () => {
        set({ showNotification: false })
      },

      reset: () =>
        set({
          isRunning: false,
          isPaused: false,
          taskId: null,
          taskTitle: null,
          mode: 'countdown',
          plannedSeconds: 0,
          elapsedSeconds: 0,
          remainingSeconds: 0,
          sessionStartTime: null,
          accumulatedSeconds: 0,
          isTimeUp: false,
          showNotification: false,
        }),
    }),
    {
      name: 'timer-storage',
      // Persist only essential data for session recovery
      partialize: (state) => ({
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        isMinimized: state.isMinimized,
        position: state.position,
        taskId: state.taskId,
        taskTitle: state.taskTitle,
        mode: state.mode,
        plannedSeconds: state.plannedSeconds,
        elapsedSeconds: state.elapsedSeconds,
        remainingSeconds: state.remainingSeconds,
        accumulatedSeconds: state.accumulatedSeconds,
        isTimeUp: state.isTimeUp,
        taskTimeStates: state.taskTimeStates,
      }),
    }
  )
)

// Helper function to format time
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Helper function to format minutes to readable string
export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

// Hook to check if timer store is hydrated (prevents SSR mismatch)
export const useTimerHydration = () => {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    // Zustand persist rehydrates synchronously after mount
    // We wait a tick to ensure localStorage state is loaded
    const unsubFinishHydration = useTimerStore.persist.onFinishHydration(() => {
      setIsHydrated(true)
    })

    // If already rehydrated (e.g., navigating between pages)
    if (useTimerStore.persist.hasHydrated()) {
      setIsHydrated(true)
    }

    return () => {
      unsubFinishHydration()
    }
  }, [])

  return isHydrated
}
