import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useState } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type TimerMode = 'countdown' | 'stopwatch'

interface SavedTaskTime {
  elapsedSeconds: number
  remainingSeconds: number
}

interface TimerState {
  // What task is being timed
  taskId: string | null
  taskTitle: string | null

  // Timer lifecycle
  isRunning: boolean
  isPaused: boolean
  isStopping: boolean

  // Timer config
  mode: TimerMode
  plannedSeconds: number

  // ── Time tracking (all in seconds) ──
  // The ONLY source of truth for elapsed time:
  //   when running: frozenElapsed + floor((Date.now() - startedAt) / 1000)
  //   when paused:  frozenElapsed
  //   when stopped: 0
  startedAt: number | null     // Date.now() timestamp, null when paused/stopped
  frozenElapsed: number        // Seconds banked from before current run segment
  elapsedSeconds: number       // Computed on each tick (for UI reactivity)
  remainingSeconds: number     // plannedSeconds - elapsedSeconds (countdown only)

  // How much actualMinutes the task had BEFORE this timer chain started.
  // Used to calculate correct total: baseActualMinutes + ceil(elapsed/60)
  baseActualMinutes: number

  // Notification
  isTimeUp: boolean
  showNotification: boolean

  // Per-task saved time (for stop → resume later)
  taskTimeStates: Record<string, SavedTaskTime>

  // Dialog: task exceeded planned time, ask for extension
  pendingStart: {
    taskId: string
    taskTitle: string
    plannedMinutes: number
    alreadyWorkedMinutes: number
  } | null

  // UI
  isMinimized: boolean
  position: { x: number; y: number } | null

  // ── Actions ──
  startTimer: (taskId: string, taskTitle: string, plannedMinutes?: number, alreadyWorkedMinutes?: number) => void
  pauseTimer: () => void
  resumeTimer: () => void
  extendTimer: (minutes: number) => void
  stopTimer: () => StopResult | null
  completeTask: () => StopResult | null
  tick: () => void
  dismissNotification: () => void
  reset: () => void
  setPendingStart: (taskId: string, taskTitle: string, plannedMinutes: number, alreadyWorkedMinutes: number) => void
  confirmPendingStart: (additionalMinutes: number) => void
  cancelPendingStart: () => void
  clearTaskTimeState: (taskId: string) => void
  toggleMinimize: () => void
  setPosition: (position: { x: number; y: number } | null) => void
  syncFromBroadcast: (state: Partial<TimerState>) => void
}

interface StopResult {
  taskId: string
  elapsedSeconds: number      // Total elapsed in this timer chain
  baseActualMinutes: number   // What actualMinutes was before timer started
}

// ─── BroadcastChannel ───────────────────────────────────────────────────────────

let broadcastChannel: BroadcastChannel | null = null

const getBroadcastChannel = () => {
  if (typeof window === 'undefined') return null
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel('timer-sync')
  }
  return broadcastChannel
}

const broadcast = (state: Partial<TimerState>) => {
  const channel = getBroadcastChannel()
  if (channel) {
    channel.postMessage({ type: 'TIMER_STATE_UPDATE', state })
  }
}

// ─── Notification helpers ───────────────────────────────────────────────────────

const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

const playNotificationSound = () => {
  if (typeof window === 'undefined') return
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const beep = (freq: number, delay: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + duration)
    }
    beep(880, 0, 0.5)
    beep(880, 0.6, 0.5)
    beep(1047, 1.2, 0.7)
  } catch (e) {
    console.warn('Could not play notification sound:', e)
  }
}

const notifyTimeUp = (taskTitle: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('⏰ Czas minął!', {
      body: `Zadanie "${taskTitle}" - czas się skończył. Przedłuż lub zakończ.`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'timer-notification',
      requireInteraction: true,
    })
  }
  playNotificationSound()
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Calculate current elapsed from frozen + wall clock */
const computeElapsed = (frozenElapsed: number, startedAt: number | null): number => {
  if (!startedAt) return frozenElapsed
  return frozenElapsed + Math.floor((Date.now() - startedAt) / 1000)
}

// ─── Store ──────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  taskId: null as string | null,
  taskTitle: null as string | null,
  isRunning: false,
  isPaused: false,
  isStopping: false,
  mode: 'countdown' as TimerMode,
  plannedSeconds: 0,
  startedAt: null as number | null,
  frozenElapsed: 0,
  elapsedSeconds: 0,
  remainingSeconds: 0,
  baseActualMinutes: 0,
  isTimeUp: false,
  showNotification: false,
  taskTimeStates: {} as Record<string, SavedTaskTime>,
  pendingStart: null as TimerState['pendingStart'],
  isMinimized: false,
  position: null as { x: number; y: number } | null,
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ── Start ─────────────────────────────────────────────────────────────
      startTimer: (taskId, taskTitle, plannedMinutes, alreadyWorkedMinutes = 0) => {
        requestNotificationPermission()

        // If task already exceeded planned time → ask user for extension
        if (plannedMinutes && alreadyWorkedMinutes >= plannedMinutes) {
          set({ pendingStart: { taskId, taskTitle, plannedMinutes, alreadyWorkedMinutes } })
          return
        }

        const saved = get().taskTimeStates[taskId]
        const initialElapsed = saved?.elapsedSeconds || 0
        const initialRemaining = saved?.remainingSeconds ?? (plannedMinutes ? plannedMinutes * 60 : 0)
        const mode: TimerMode = plannedMinutes ? 'countdown' : 'stopwatch'

        const newState = {
          isRunning: true,
          isPaused: false,
          isStopping: false,
          taskId,
          taskTitle,
          mode,
          plannedSeconds: plannedMinutes ? plannedMinutes * 60 : 0,
          startedAt: Date.now(),
          frozenElapsed: initialElapsed,
          elapsedSeconds: initialElapsed,
          remainingSeconds: initialRemaining,
          baseActualMinutes: alreadyWorkedMinutes,
          isTimeUp: false,
          showNotification: false,
          pendingStart: null,
        }
        set(newState)
        broadcast(newState)
      },

      // ── Pending start (exceeded planned time) ─────────────────────────────
      setPendingStart: (taskId, taskTitle, plannedMinutes, alreadyWorkedMinutes) => {
        set({ pendingStart: { taskId, taskTitle, plannedMinutes, alreadyWorkedMinutes } })
      },

      confirmPendingStart: (additionalMinutes) => {
        const { pendingStart, taskTimeStates } = get()
        if (!pendingStart) return
        requestNotificationPermission()

        const saved = taskTimeStates[pendingStart.taskId]
        const previousElapsed = saved?.elapsedSeconds || 0
        const additionalSeconds = additionalMinutes * 60

        // Clear saved state since we're resuming
        const newTaskTimeStates = { ...taskTimeStates }
        delete newTaskTimeStates[pendingStart.taskId]

        const newState = {
          isRunning: true,
          isPaused: false,
          isStopping: false,
          taskId: pendingStart.taskId,
          taskTitle: pendingStart.taskTitle,
          mode: 'countdown' as TimerMode,
          plannedSeconds: previousElapsed + additionalSeconds,
          startedAt: Date.now(),
          frozenElapsed: previousElapsed,
          elapsedSeconds: previousElapsed,
          remainingSeconds: additionalSeconds,
          baseActualMinutes: pendingStart.alreadyWorkedMinutes,
          isTimeUp: false,
          showNotification: false,
          pendingStart: null,
          taskTimeStates: newTaskTimeStates,
        }
        set(newState)
        broadcast(newState)
      },

      cancelPendingStart: () => set({ pendingStart: null }),

      clearTaskTimeState: (taskId) => {
        const next = { ...get().taskTimeStates }
        delete next[taskId]
        set({ taskTimeStates: next })
      },

      // ── Pause / Resume ────────────────────────────────────────────────────
      pauseTimer: () => {
        const { isRunning, isPaused, startedAt, frozenElapsed } = get()
        if (!isRunning || isPaused) return

        // Bank elapsed time and clear wall-clock reference
        const elapsed = computeElapsed(frozenElapsed, startedAt)
        const newState = {
          isPaused: true,
          startedAt: null as number | null,
          frozenElapsed: elapsed,
          elapsedSeconds: elapsed,
        }
        set(newState)
        broadcast(newState)
      },

      resumeTimer: () => {
        const { isRunning, isPaused, isTimeUp } = get()
        if (!isRunning || !isPaused || isTimeUp) return

        const newState = {
          isPaused: false,
          startedAt: Date.now(),
        }
        set(newState)
        broadcast(newState)
      },

      // ── Extend (after time-up) ────────────────────────────────────────────
      extendTimer: (minutes) => {
        const { remainingSeconds, plannedSeconds, frozenElapsed, startedAt } = get()
        const elapsed = computeElapsed(frozenElapsed, startedAt)
        const additionalSeconds = minutes * 60

        const newState = {
          remainingSeconds: remainingSeconds + additionalSeconds,
          plannedSeconds: plannedSeconds + additionalSeconds,
          isTimeUp: false,
          showNotification: false,
          isPaused: false,
          startedAt: Date.now(),
          frozenElapsed: elapsed,
        }
        set(newState)
        broadcast(newState)
      },

      // ── Stop (save state, allow resume later) ─────────────────────────────
      stopTimer: () => {
        const { taskId, isRunning, isStopping, frozenElapsed, startedAt, remainingSeconds, taskTimeStates, baseActualMinutes } = get()
        if (!isRunning || !taskId || isStopping) return null

        set({ isStopping: true })

        const elapsed = computeElapsed(frozenElapsed, startedAt)

        // Save state so user can resume this task later
        const newTaskTimeStates = {
          ...taskTimeStates,
          [taskId]: { elapsedSeconds: elapsed, remainingSeconds },
        }

        const result: StopResult = { taskId, elapsedSeconds: elapsed, baseActualMinutes }

        const newState = {
          ...INITIAL_STATE,
          taskTimeStates: newTaskTimeStates,
          // Preserve UI preferences
          isMinimized: get().isMinimized,
          position: get().position,
        }
        set(newState)
        broadcast(newState)

        return result
      },

      // ── Complete (stop + clear saved state) ───────────────────────────────
      completeTask: () => {
        const { taskId, isStopping } = get()
        if (isStopping || !taskId) return null

        const completedTaskId = taskId
        const result = get().stopTimer()

        // Remove saved state — completed task won't be resumed
        const next = { ...get().taskTimeStates }
        delete next[completedTaskId]
        set({ taskTimeStates: next })
        broadcast({ taskTimeStates: next })

        return result
      },

      // ── Tick (called every 1s by FloatingTimer) ───────────────────────────
      tick: () => {
        const { isRunning, isPaused, startedAt, frozenElapsed, mode, isTimeUp, taskTitle, plannedSeconds } = get()
        if (!isRunning || isPaused || !startedAt) return

        const elapsed = computeElapsed(frozenElapsed, startedAt)

        if (mode === 'countdown') {
          const remaining = Math.max(0, plannedSeconds - elapsed)

          if (remaining === 0 && !isTimeUp) {
            notifyTimeUp(taskTitle || 'Zadanie')

            // Save state in case user closes dialog
            const { taskId, taskTimeStates } = get()
            const newTaskTimeStates = taskId
              ? { ...taskTimeStates, [taskId]: { elapsedSeconds: elapsed, remainingSeconds: 0 } }
              : taskTimeStates

            const newState = {
              elapsedSeconds: elapsed,
              remainingSeconds: 0,
              isTimeUp: true,
              showNotification: true,
              isPaused: true,
              startedAt: null as number | null,
              frozenElapsed: elapsed,
              taskTimeStates: newTaskTimeStates,
            }
            set(newState)
            broadcast(newState)
          } else {
            set({ elapsedSeconds: elapsed, remainingSeconds: remaining })
          }
        } else {
          set({ elapsedSeconds: elapsed })
        }
      },

      // ── Notification ──────────────────────────────────────────────────────
      dismissNotification: () => {
        set({ showNotification: false, isTimeUp: false })
      },

      // ── Reset ─────────────────────────────────────────────────────────────
      reset: () => set({ ...INITIAL_STATE }),

      // ── UI ────────────────────────────────────────────────────────────────
      toggleMinimize: () => set((s) => ({ isMinimized: !s.isMinimized })),
      setPosition: (position) => set({ position }),

      // ── Cross-tab sync ────────────────────────────────────────────────────
      syncFromBroadcast: (state) => {
        if (get().isStopping) return
        set(state)
      },
    }),
    {
      name: 'timer-storage',
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
        frozenElapsed: state.frozenElapsed,
        startedAt: state.startedAt,
        baseActualMinutes: state.baseActualMinutes,
        isTimeUp: state.isTimeUp,
        taskTimeStates: state.taskTimeStates,
      }),
    }
  )
)

// ─── Helpers ────────────────────────────────────────────────────────────────────

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

// ─── Hydration hook ─────────────────────────────────────────────────────────────

export const useTimerHydration = () => {
  const [isHydrated, setIsHydrated] = useState(false)
  const syncFromBroadcast = useTimerStore((state) => state.syncFromBroadcast)

  useEffect(() => {
    const unsubFinishHydration = useTimerStore.persist.onFinishHydration(() => {
      setIsHydrated(true)
    })

    if (useTimerStore.persist.hasHydrated()) {
      setIsHydrated(true)
    }

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
