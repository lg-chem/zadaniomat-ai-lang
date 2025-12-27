import { create } from 'zustand'

interface TimerState {
  isRunning: boolean
  isPaused: boolean
  taskId: string | null
  startTime: Date | null
  pausedTime: number // accumulated paused milliseconds
  elapsedTime: number // current elapsed in seconds

  startTimer: (taskId: string) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => { taskId: string; duration: number } | null
  tick: () => void
  reset: () => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  isRunning: false,
  isPaused: false,
  taskId: null,
  startTime: null,
  pausedTime: 0,
  elapsedTime: 0,

  startTimer: (taskId) =>
    set({
      isRunning: true,
      isPaused: false,
      taskId,
      startTime: new Date(),
      pausedTime: 0,
      elapsedTime: 0,
    }),

  pauseTimer: () => {
    const { isRunning, isPaused } = get()
    if (isRunning && !isPaused) {
      set({ isPaused: true })
    }
  },

  resumeTimer: () => {
    const { isRunning, isPaused } = get()
    if (isRunning && isPaused) {
      set({ isPaused: false })
    }
  },

  stopTimer: () => {
    const { taskId, elapsedTime, isRunning } = get()
    if (!isRunning || !taskId) return null

    const duration = Math.floor(elapsedTime / 60) // convert to minutes

    set({
      isRunning: false,
      isPaused: false,
      taskId: null,
      startTime: null,
      pausedTime: 0,
      elapsedTime: 0,
    })

    return { taskId, duration }
  },

  tick: () => {
    const { isRunning, isPaused, elapsedTime } = get()
    if (isRunning && !isPaused) {
      set({ elapsedTime: elapsedTime + 1 })
    }
  },

  reset: () =>
    set({
      isRunning: false,
      isPaused: false,
      taskId: null,
      startTime: null,
      pausedTime: 0,
      elapsedTime: 0,
    }),
}))
