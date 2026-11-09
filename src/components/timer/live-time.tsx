"use client"

import { useTimerStore, formatMinutes, formatTime } from "@/stores/timer-store"
import { taskWorkedSeconds } from "@/lib/timer-actions"

type WorkedTask = {
  id: string
  actualMinutes?: number | null
  actualExtraSeconds?: number | null
}

// Worked seconds of a task with the running timer session. Only the timer's own task
// follows the ticks - every other task gets the same values and doesn't re-render.
export function useLiveWorkedSeconds(task: WorkedTask): number {
  const isTimerTask = useTimerStore((s) => s.isRunning && s.taskId === task.id)
  const elapsed = useTimerStore((s) => (s.isRunning && s.taskId === task.id ? s.elapsedSeconds : 0))
  // A session migrated from the old timer already holds the task's total
  const saveAsTotal = useTimerStore((s) => s.isRunning && s.taskId === task.id && s.saveAsTotal)
  if (!isTimerTask) return taskWorkedSeconds(task)
  return (saveAsTotal ? 0 : taskWorkedSeconds(task)) + elapsed
}

// "1:23:45" of a task, live while its timer runs
export function LiveTaskTime({ task }: { task: WorkedTask }) {
  return <>{formatTime(useLiveWorkedSeconds(task))}</>
}

// Total worked time of tasks in "2h 15min", live while one of them has the timer
export function LiveTotalMinutes({ tasks }: { tasks: WorkedTask[] }) {
  const timerTaskId = useTimerStore((s) => (s.isRunning ? s.taskId : null))
  const elapsed = useTimerStore((s) => (s.isRunning ? s.elapsedSeconds : 0))
  const saveAsTotal = useTimerStore((s) => s.isRunning && s.saveAsTotal)
  const seconds = tasks.reduce((sum, task) => {
    if (task.id !== timerTaskId) return sum + taskWorkedSeconds(task)
    return sum + (saveAsTotal ? 0 : taskWorkedSeconds(task)) + elapsed
  }, 0)
  return <>{formatMinutes(Math.floor(seconds / 60))}</>
}
