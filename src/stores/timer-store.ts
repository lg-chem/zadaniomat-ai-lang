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
  sessionStartElapsed: number // elapsedSeconds at the moment timer was started (to calculate session-only duration)

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

  // Race condition protection
  isStopping: boolean

  // Actions
  startTimer: (taskId: string, taskTitle: string, plannedMinutes?: number, alreadyWorkedMinutes?: number) => void
  pauseTimer: () => void
  resumeTimer: () => void
  extendTimer: (minutes: number) => void
  stopTimer: () => { taskId: string; durationSeconds: number; sessionDurationSeconds: number } | null
  completeTask: () => { taskId: string; durationSeconds: number; sessionDurationSeconds: number } | null
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
  // Cross-tab sync
  syncFromBroadcast: (state: Partial<TimerState>) => void
}

// BroadcastChannel for cross-tab synchronization
let broadcastChannel: BroadcastChannel | null = null

const getBroadcastChannel = () => {
  if (typeof window === 'undefined') return null
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel('timer-sync')
  }
  return broadcastChannel
}

const broadcastState = (state: Partial<TimerState>) => {
  const channel = getBroadcastChannel()
  if (channel) {
    channel.postMessage({ type: 'TIMER_STATE_UPDATE', state })
  }
}

// Helper to request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

// Helper to play notification sound
const playNotificationSound = () => {
  if (typeof window === 'undefined') return

  try {
    // Create audio context for notification sound
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    // Create oscillator for beep sound
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Configure sound - pleasant alert tone
    oscillator.frequency.value = 880 // A5 note
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)

    // Play 3 beeps
    setTimeout(() => {
      const osc2 = audioContext.createOscillator()
      const gain2 = audioContext.createGain()
      osc2.connect(gain2)
      gain2.connect(audioContext.destination)
      osc2.frequency.value = 880
      osc2.type = 'sine'
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime)
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      osc2.start(audioContext.currentTime)
      osc2.stop(audioContext.currentTime + 0.5)
    }, 600)

    setTimeout(() => {
      const osc3 = audioContext.createOscillator()
      const gain3 = audioContext.createGain()
      osc3.connect(gain3)
      gain3.connect(audioContext.destination)
      osc3.frequency.value = 1047 // C6 note - higher for attention
      osc3.type = 'sine'
      gain3.gain.setValueAtTime(0.3, audioContext.currentTime)
      gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.7)
      osc3.start(audioContext.currentTime)
      osc3.stop(audioContext.currentTime + 0.7)
    }, 1200)
  } catch (e) {
    console.warn('Could not play notification sound:', e)
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

// Combined notification function
const notifyTimeUp = (taskTitle: string) => {
  // 1. Browser notification
  showBrowserNotification(
    '⏰ Czas minął!',
    `Zadanie "${taskTitle}" - czas się skończył. Przedłuż lub zakończ.`
  )

  // 2. Sound notification
  playNotificationSound()
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
      sessionStartElapsed: 0,
      isTimeUp: false,
      showNotification: false,
      taskTimeStates: {},
      pendingStart: null,
      isStopping: false,

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

        const newState = {
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
          sessionStartElapsed: initialElapsed,
          isTimeUp: false,
          showNotification: false,
          pendingStart: null,
          isStopping: false,
        }
        set(newState)
        broadcastState(newState)
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

        const newState = {
          isRunning: true,
          isPaused: false,
          taskId: pendingStart.taskId,
          taskTitle: pendingStart.taskTitle,
          mode: 'countdown' as TimerMode,
          // plannedSeconds = previous elapsed + new time, so tick() calculates remaining correctly
          plannedSeconds: previousElapsed + additionalSeconds,
          elapsedSeconds: previousElapsed,
          remainingSeconds: additionalSeconds,
          sessionStartTime: new Date(),
          accumulatedSeconds: previousElapsed,
          sessionStartElapsed: previousElapsed,
          isTimeUp: false,
          showNotification: false,
          pendingStart: null,
          taskTimeStates: newTaskTimeStates,
          isStopping: false,
        }
        set(newState)
        broadcastState(newState)
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
        const { isRunning, isPaused, elapsedSeconds } = get()
        if (isRunning && !isPaused) {
          const newState = {
            isPaused: true,
            accumulatedSeconds: elapsedSeconds,
            sessionStartTime: null,
          }
          set(newState)
          broadcastState(newState)
        }
      },

      resumeTimer: () => {
        const { isRunning, isPaused, isTimeUp } = get()
        if (isRunning && isPaused && !isTimeUp) {
          const newState = {
            isPaused: false,
            sessionStartTime: new Date(),
          }
          set(newState)
          broadcastState(newState)
        }
      },

      extendTimer: (minutes) => {
        const { remainingSeconds, elapsedSeconds, accumulatedSeconds: oldAccumulated, plannedSeconds } = get()
        const additionalSeconds = minutes * 60

        console.log('[extendTimer] Before:', {
          elapsedSeconds,
          remainingSeconds,
          oldAccumulated,
          minutes,
          additionalSeconds
        })

        const newState = {
          remainingSeconds: remainingSeconds + additionalSeconds,
          plannedSeconds: plannedSeconds + additionalSeconds,
          isTimeUp: false,
          showNotification: false,
          isPaused: false,
          sessionStartTime: new Date(),
          accumulatedSeconds: elapsedSeconds, // Sync accumulated with elapsed before resuming
        }
        set(newState)
        broadcastState(newState)

        console.log('[extendTimer] After:', {
          newAccumulated: elapsedSeconds,
          newRemaining: remainingSeconds + additionalSeconds
        })
      },

      stopTimer: () => {
        const { taskId, elapsedSeconds, remainingSeconds, isRunning, taskTimeStates, isStopping, sessionStartElapsed } = get()

        // Race condition protection - prevent multiple simultaneous stops
        if (!isRunning || !taskId || isStopping) return null

        // Set flag immediately to prevent race conditions
        set({ isStopping: true })

        // durationSeconds = total elapsed across all sessions in this chain
        // sessionDurationSeconds = only time worked in THIS session (since last start)
        const durationSeconds = elapsedSeconds
        const sessionDurationSeconds = elapsedSeconds - sessionStartElapsed
        const stoppedTaskId = taskId

        console.log('[stopTimer] Saving state:', {
          taskId,
          elapsedSeconds,
          remainingSeconds,
          durationSeconds,
          sessionDurationSeconds,
          sessionStartElapsed,
        })

        // Save state for this task so we can resume later
        const newTaskTimeStates = {
          ...taskTimeStates,
          [taskId]: {
            elapsedSeconds,
            remainingSeconds,
          }
        }

        const newState = {
          isRunning: false,
          isPaused: false,
          taskId: null,
          taskTitle: null,
          mode: 'countdown' as TimerMode,
          plannedSeconds: 0,
          elapsedSeconds: 0,
          remainingSeconds: 0,
          sessionStartTime: null,
          accumulatedSeconds: 0,
          sessionStartElapsed: 0,
          isTimeUp: false,
          showNotification: false,
          taskTimeStates: newTaskTimeStates,
          isStopping: false, // Reset flag
        }

        set(newState)
        broadcastState(newState)

        return { taskId: stoppedTaskId, durationSeconds, sessionDurationSeconds }
      },

      completeTask: () => {
        const { taskId, isStopping } = get()

        // Race condition protection
        if (isStopping || !taskId) return null

        // Capture taskId before stopTimer clears it
        const completedTaskId = taskId

        const result = get().stopTimer()

        // Clear saved state for completed task (no need to resume)
        // stopTimer already added to taskTimeStates, so remove it
        const newTaskTimeStates = { ...get().taskTimeStates }
        delete newTaskTimeStates[completedTaskId]
        set({ taskTimeStates: newTaskTimeStates })
        broadcastState({ taskTimeStates: newTaskTimeStates })

        return result
      },

      tick: () => {
        const { isRunning, isPaused, sessionStartTime, accumulatedSeconds, remainingSeconds, mode, isTimeUp, taskTitle, plannedSeconds } = get()

        if (!isRunning || isPaused || !sessionStartTime) return

        // Calculate real elapsed time based on wall clock (not setInterval ticks)
        const now = new Date()
        const startTime = sessionStartTime instanceof Date ? sessionStartTime : new Date(sessionStartTime)
        if (isNaN(startTime.getTime())) {
          // Invalid sessionStartTime (corrupted localStorage) - reset it
          set({ sessionStartTime: new Date(), accumulatedSeconds: get().elapsedSeconds })
          return
        }
        const sessionSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        const newElapsedSeconds = accumulatedSeconds + sessionSeconds

        if (mode === 'countdown') {
          // Calculate remaining based on planned time minus elapsed
          const totalElapsed = newElapsedSeconds
          const newRemainingSeconds = Math.max(0, plannedSeconds - totalElapsed)

          // Sprawdź czy czas się skończył
          if (newRemainingSeconds === 0 && !isTimeUp) {
            // Combined notification: browser + sound + voice
            notifyTimeUp(taskTitle || 'Zadanie')

            // Save state to taskTimeStates so it can be recovered if user closes dialog
            const { taskId, taskTimeStates } = get()
            const newTaskTimeStates = taskId ? {
              ...taskTimeStates,
              [taskId]: {
                elapsedSeconds: newElapsedSeconds,
                remainingSeconds: 0,
              }
            } : taskTimeStates

            const newState = {
              elapsedSeconds: newElapsedSeconds,
              remainingSeconds: 0,
              isTimeUp: true,
              showNotification: true,
              isPaused: true, // Auto-pauza po zakończeniu czasu
              taskTimeStates: newTaskTimeStates,
            }
            set(newState)
            broadcastState(newState)
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
        // Reset isTimeUp too, so the user can resume the timer via the widget
        set({ showNotification: false, isTimeUp: false })
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
          sessionStartElapsed: 0,
          isTimeUp: false,
          showNotification: false,
          isStopping: false,
        }),

      // Cross-tab synchronization - merge carefully instead of blind overwrite
      syncFromBroadcast: (state) => {
        console.log('[syncFromBroadcast] Received state update:', state)
        const current = get()
        // Don't accept broadcast while we're in the middle of stopping
        if (current.isStopping) return
        set(state)
      },
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
        sessionStartElapsed: state.sessionStartElapsed,
        isTimeUp: state.isTimeUp,
        taskTimeStates: state.taskTimeStates,
        // Persist sessionStartTime as ISO string so timer survives page refresh
        sessionStartTime: state.sessionStartTime ? (state.sessionStartTime instanceof Date ? state.sessionStartTime.toISOString() : state.sessionStartTime) : null,
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
// Also sets up cross-tab synchronization
export const useTimerHydration = () => {
  const [isHydrated, setIsHydrated] = useState(false)
  const syncFromBroadcast = useTimerStore((state) => state.syncFromBroadcast)

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

    // Set up BroadcastChannel listener for cross-tab sync
    const channel = getBroadcastChannel()
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TIMER_STATE_UPDATE' && event.data?.state) {
        syncFromBroadcast(event.data.state)
      }
    }

    if (channel) {
      channel.addEventListener('message', handleMessage)
    }

    return () => {
      unsubFinishHydration()
      if (channel) {
        channel.removeEventListener('message', handleMessage)
      }
    }
  }, [syncFromBroadcast])

  return isHydrated
}

