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
  stopTimer: () => { taskId: string; duration: number } | null
  completeTask: () => { taskId: string; duration: number } | null
  tick: () => void
  dismissNotification: () => void
  reset: () => void
  // New actions
  setPendingStart: (taskId: string, taskTitle: string, plannedMinutes: number, alreadyWorkedMinutes: number) => void
  confirmPendingStart: (additionalMinutes: number) => void
  cancelPendingStart: () => void
  clearTaskTimeState: (taskId: string) => void
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

        const totalPlannedSeconds = additionalMinutes * 60

        // Clear any saved state for this task since we're starting fresh with new time
        const newTaskTimeStates = { ...taskTimeStates }
        delete newTaskTimeStates[pendingStart.taskId]

        set({
          isRunning: true,
          isPaused: false,
          taskId: pendingStart.taskId,
          taskTitle: pendingStart.taskTitle,
          mode: 'countdown',
          plannedSeconds: totalPlannedSeconds,
          elapsedSeconds: 0,
          remainingSeconds: totalPlannedSeconds,
          sessionStartTime: new Date(),
          accumulatedSeconds: 0,
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
        const { remainingSeconds, isTimeUp } = get()
        const additionalSeconds = minutes * 60

        set({
          remainingSeconds: remainingSeconds + additionalSeconds,
          plannedSeconds: get().plannedSeconds + additionalSeconds,
          isTimeUp: false,
          showNotification: false,
          isPaused: false,
          sessionStartTime: new Date(),
        })
      },

      stopTimer: () => {
        const { taskId, elapsedSeconds, remainingSeconds, isRunning, taskTimeStates } = get()
        if (!isRunning || !taskId) return null

        const duration = Math.ceil(elapsedSeconds / 60) // zaokrąglenie w górę do minut

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

        return { taskId, duration }
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
        const { isRunning, isPaused, elapsedSeconds, remainingSeconds, mode, isTimeUp, taskTitle } = get()

        if (!isRunning || isPaused) return

        const newElapsedSeconds = elapsedSeconds + 1

        if (mode === 'countdown') {
          const newRemainingSeconds = Math.max(0, remainingSeconds - 1)

          // Sprawdź czy czas się skończył
          if (newRemainingSeconds === 0 && !isTimeUp) {
            showBrowserNotification(
              '⏰ Czas minął!',
              `Zadanie "${taskTitle}" - czas się skończył. Przedłuż lub zakończ.`
            )

            set({
              elapsedSeconds: newElapsedSeconds,
              remainingSeconds: 0,
              isTimeUp: true,
              showNotification: true,
              isPaused: true, // Auto-pauza po zakończeniu czasu
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
