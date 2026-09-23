import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useState } from 'react'

// Result of ending a timer session - the time to credit to the task
export interface TimerSessionResult {
  taskId: string
  sessionSeconds: number      // Czas przepracowany w tej sesji (dodawany do zadania)
  // Set only for a session migrated from the old timer format, where the timer
  // held the task's whole tracked time - it is saved as the total, not added
  totalSeconds?: number
}

interface TimerState {
  // Core state
  isRunning: boolean          // Czy jest aktywna sesja (liczy się albo jest na pauzie)
  isPaused: boolean
  isMinimized: boolean
  position: { x: number; y: number } | null  // null = default position (top-right)
  taskId: string | null
  taskTitle: string | null

  // Time tracking - wall clock based, so it survives reloads and background tabs
  plannedSeconds: number      // Planowany czas zadania razem z przedłużeniami (0 = bez planu)
  baseSeconds: number         // Czas przepracowany nad zadaniem przed tą sesją
  accumulatedSeconds: number  // Czas sesji zebrany przed ostatnim wznowieniem
  runningSince: number | null // Timestamp (ms) ostatniego startu/wznowienia, null na pauzie
  elapsedSeconds: number      // Czas bieżącej sesji (odświeżany przez tick)
  saveAsTotal: boolean        // Sesja przeniesiona ze starego formatu timera

  // Notification state - the timer keeps counting after the planned time
  notifiedAtSeconds: number   // Planowany czas, o którego upływie już powiadomiono
  showNotification: boolean

  // Extra planned time added per task, remembered after stopping
  plannedExtensions: Record<string, number>

  // Actions
  startTimer: (taskId: string, taskTitle: string, plannedMinutes?: number, alreadyWorkedMinutes?: number) => void
  pauseTimer: () => void
  resumeTimer: () => void
  extendTimer: (minutes: number) => void
  stopTimer: () => TimerSessionResult | null
  completeTask: () => TimerSessionResult | null
  tick: () => void
  dismissNotification: () => void
  reset: () => void
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
    '⏰ Minął zaplanowany czas',
    `Zadanie "${taskTitle}" - timer liczy dalej. Przedłuż, zatrzymaj albo zakończ.`
  )

  // 2. Sound notification
  playNotificationSound()
}

// Session time (seconds) at a given moment, computed from the wall clock
const sessionSecondsAt = (
  state: Pick<TimerState, 'accumulatedSeconds' | 'runningSince'>,
  now = Date.now()
) => {
  if (!state.runningSince) return state.accumulatedSeconds
  return state.accumulatedSeconds + Math.max(0, Math.floor((now - state.runningSince) / 1000))
}

const idleSession = {
  isRunning: false,
  isPaused: false,
  taskId: null,
  taskTitle: null,
  plannedSeconds: 0,
  baseSeconds: 0,
  accumulatedSeconds: 0,
  runningSince: null,
  elapsedSeconds: 0,
  saveAsTotal: false,
  notifiedAtSeconds: 0,
  showNotification: false,
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...idleSession,
      isMinimized: false,
      position: null,
      plannedExtensions: {},

      startTimer: (taskId, taskTitle, plannedMinutes, alreadyWorkedMinutes = 0) => {
        const state = get()

        if (state.isRunning) {
          // Same task - just make sure it is counting
          if (state.taskId === taskId) get().resumeTimer()
          // Another task - the caller must stop and save it first (see startTaskTimer)
          return
        }

        requestNotificationPermission()

        const plannedSeconds = plannedMinutes
          ? plannedMinutes * 60 + (state.plannedExtensions[taskId] || 0)
          : 0
        const baseSeconds = Math.max(0, alreadyWorkedMinutes) * 60

        const newState = {
          ...idleSession,
          isRunning: true,
          taskId,
          taskTitle,
          plannedSeconds,
          baseSeconds,
          runningSince: Date.now(),
          // Already over plan when starting - the widget shows it, no need for a popup
          notifiedAtSeconds: plannedSeconds > 0 && baseSeconds >= plannedSeconds ? plannedSeconds : 0,
        }
        set(newState)
        broadcastState(newState)
      },

      toggleMinimize: () => {
        set((state) => ({ isMinimized: !state.isMinimized }))
      },

      setPosition: (position) => {
        set({ position })
      },

      pauseTimer: () => {
        const state = get()
        if (!state.isRunning || state.isPaused) return

        const sessionSeconds = sessionSecondsAt(state)
        const newState = {
          isPaused: true,
          accumulatedSeconds: sessionSeconds,
          elapsedSeconds: sessionSeconds,
          runningSince: null,
        }
        set(newState)
        broadcastState(newState)
      },

      resumeTimer: () => {
        const { isRunning, isPaused } = get()
        if (!isRunning || !isPaused) return

        const newState = {
          isPaused: false,
          runningSince: Date.now(),
        }
        set(newState)
        broadcastState(newState)
      },

      extendTimer: (minutes) => {
        const state = get()
        if (!state.isRunning || !state.taskId) return

        // Extend from the current worked time when already over plan,
        // so "+15 min" always means 15 more minutes from now
        const workedSeconds = state.baseSeconds + sessionSecondsAt(state)
        const newPlannedSeconds = Math.max(state.plannedSeconds, workedSeconds) + minutes * 60
        const addedSeconds = newPlannedSeconds - state.plannedSeconds

        const newState = {
          plannedSeconds: newPlannedSeconds,
          showNotification: false,
          plannedExtensions: {
            ...state.plannedExtensions,
            [state.taskId]: (state.plannedExtensions[state.taskId] || 0) + addedSeconds,
          },
        }
        set(newState)
        broadcastState(newState)
      },

      stopTimer: () => {
        const state = get()
        if (!state.isRunning || !state.taskId) return null

        const sessionSeconds = sessionSecondsAt(state)
        const result: TimerSessionResult = {
          taskId: state.taskId,
          sessionSeconds,
          ...(state.saveAsTotal && { totalSeconds: state.baseSeconds + sessionSeconds }),
        }

        set(idleSession)
        broadcastState(idleSession)

        return result
      },

      completeTask: () => {
        const result = get().stopTimer()
        if (!result) return null

        // Completed task won't be resumed - forget its extensions
        const plannedExtensions = { ...get().plannedExtensions }
        delete plannedExtensions[result.taskId]
        set({ plannedExtensions })
        broadcastState({ plannedExtensions })

        return result
      },

      tick: () => {
        const state = get()
        if (!state.isRunning || state.isPaused || !state.runningSince) return

        const elapsedSeconds = sessionSecondsAt(state)
        const workedSeconds = state.baseSeconds + elapsedSeconds

        // Planned time reached - notify once, but keep counting
        if (
          state.plannedSeconds > 0 &&
          workedSeconds >= state.plannedSeconds &&
          state.notifiedAtSeconds < state.plannedSeconds
        ) {
          notifyTimeUp(state.taskTitle || 'Zadanie')
          const newState = {
            notifiedAtSeconds: state.plannedSeconds,
            showNotification: true,
          }
          set({ ...newState, elapsedSeconds })
          broadcastState(newState)
          return
        }

        if (elapsedSeconds !== state.elapsedSeconds) {
          set({ elapsedSeconds })
        }
      },

      dismissNotification: () => {
        set({ showNotification: false })
        broadcastState({ showNotification: false })
      },

      reset: () => {
        set(idleSession)
        broadcastState(idleSession)
      },

      // Cross-tab synchronization
      syncFromBroadcast: (state) => {
        set(state)
      },
    }),
    {
      name: 'timer-storage',
      version: 1,
      // Persist only essential data for session recovery
      partialize: (state) => ({
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        isMinimized: state.isMinimized,
        position: state.position,
        taskId: state.taskId,
        taskTitle: state.taskTitle,
        plannedSeconds: state.plannedSeconds,
        baseSeconds: state.baseSeconds,
        accumulatedSeconds: state.accumulatedSeconds,
        runningSince: state.runningSince,
        elapsedSeconds: state.elapsedSeconds,
        saveAsTotal: state.saveAsTotal,
        notifiedAtSeconds: state.notifiedAtSeconds,
        showNotification: state.showNotification,
        plannedExtensions: state.plannedExtensions,
      }),
      migrate: (persistedState, version) => {
        const old = (persistedState || {}) as Record<string, unknown>
        if (version >= 1) return old as Partial<TimerState>

        // Old format: elapsedSeconds held the task's time tracked across timer
        // sessions. Carry an active session over, so no worked time is lost.
        const kept = {
          isMinimized: old.isMinimized === true,
          position: (old.position as TimerState['position']) ?? null,
        }
        if (!old.isRunning || typeof old.taskId !== 'string') return kept

        const workedSeconds = Number(old.elapsedSeconds) || 0
        const plannedSeconds = Number(old.plannedSeconds) || 0
        const session = {
          ...kept,
          ...idleSession,
          isRunning: true,
          isPaused: true,
          taskId: old.taskId,
          taskTitle: typeof old.taskTitle === 'string' ? old.taskTitle : null,
          plannedSeconds,
          notifiedAtSeconds: plannedSeconds > 0 && workedSeconds >= plannedSeconds ? plannedSeconds : 0,
        }

        if (typeof old.sessionStartElapsed === 'number') {
          // Stored where the session started and saved only the session's time -
          // same as now, so keep it running from its persisted start time
          const baseSeconds = old.sessionStartElapsed
          const startedAt = typeof old.sessionStartTime === 'string' ? Date.parse(old.sessionStartTime) : NaN
          const isCounting = !old.isPaused && !Number.isNaN(startedAt)
          const bankedSeconds = isCounting ? Number(old.accumulatedSeconds) || 0 : workedSeconds
          return {
            ...session,
            isPaused: !isCounting,
            baseSeconds,
            accumulatedSeconds: Math.max(0, bankedSeconds - baseSeconds),
            runningSince: isCounting ? startedAt : null,
            elapsedSeconds: Math.max(0, workedSeconds - baseSeconds),
          }
        }

        // No start time was stored (the timer froze after a reload) and stop saved
        // elapsedSeconds as the task's total - keep it paused and save it the same way
        return {
          ...session,
          accumulatedSeconds: workedSeconds,
          elapsedSeconds: workedSeconds,
          saveAsTotal: true,
        }
      },
    }
  )
)

// Total time worked on the active task (before this session + this session)
export const selectWorkedSeconds = (state: Pick<TimerState, 'baseSeconds' | 'elapsedSeconds'>) =>
  state.baseSeconds + state.elapsedSeconds

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
