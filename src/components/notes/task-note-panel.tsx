"use client"

import Link from "next/link"
import { toast } from "sonner"
import { useSWRConfig } from "swr"
import { ArrowLeft, Check, ExternalLink, Pause, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EditableDescription } from "@/components/tasks/editable-description"
import { SubtaskList } from "@/components/tasks/subtask-list"
import { useTimerStore, formatTime } from "@/stores/timer-store"
import { startTaskTimer, stopTimerForTask, taskWorkedSeconds } from "@/lib/timer-actions"
import { formatDayShort } from "@/lib/task-recurrence"
import type { TaskNote } from "@/hooks/use-notes"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nowe",
  IN_PROGRESS: "W trakcie",
  COMPLETED: "Zakończone",
  CANCELLED: "Anulowane",
  TO_TRANSFER: "Do przeniesienia",
}

export function scheduleLink(task: Pick<TaskNote, "id" | "scheduledDate">) {
  const day = task.scheduledDate?.slice(0, 10)
  return day ? `/schedule?date=${day}&task=${task.id}` : "/schedule"
}

interface TaskNotePanelProps {
  task: TaskNote
  onBack: () => void
}

async function setTaskStatus(taskId: string, status: string) {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error()
}

// Start / pause with the live time; the only part that re-renders every second
function TimerButton({ task, onStatusChanged }: { task: TaskNote; onStatusChanged: () => void }) {
  const timer = useTimerStore()
  const isTimerTask = timer.isRunning && timer.taskId === task.id
  const workedSeconds = isTimerTask
    ? (timer.saveAsTotal ? 0 : taskWorkedSeconds(task)) + timer.elapsedSeconds
    : taskWorkedSeconds(task)

  const handleTimer = async () => {
    if (isTimerTask) {
      if (timer.isPaused) timer.resumeTimer()
      else timer.pauseTimer()
      return
    }
    // A timer of another task is stopped and saved first
    startTaskTimer(task)
    if (task.status !== "IN_PROGRESS") {
      try {
        await setTaskStatus(task.id, "IN_PROGRESS")
        onStatusChanged()
      } catch {
        toast.error("Nie udało się zmienić statusu")
      }
    }
  }

  return (
    <Button onClick={handleTimer} variant={isTimerTask ? "default" : "outline"}>
      {isTimerTask && !timer.isPaused ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
      {isTimerTask ? (timer.isPaused ? "Wznów" : "Pauza") : "Start"}
      <span className={cn("ml-2 tabular-nums", isTimerTask ? "opacity-90" : "text-muted-foreground")}>
        {formatTime(workedSeconds)}
      </span>
    </Button>
  )
}

// A task's description in the notes view, with the timer and a way back to the schedule
export function TaskNotePanel({ task, onBack }: TaskNotePanelProps) {
  const { mutate } = useSWRConfig()
  const revalidateTasks = () => mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"))
  const done = task.status === "COMPLETED"
  const day = task.scheduledDate?.slice(0, 10)

  const handleDone = async () => {
    const status = done ? "NEW" : "COMPLETED"
    try {
      if (!done) await stopTimerForTask(task.id, { complete: true })
      await setTaskStatus(task.id, status)
      if (!done) toast.success("Zadanie zrobione")
    } catch {
      toast.error("Nie udało się zmienić statusu")
    } finally {
      revalidateTasks()
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Lista
        </Button>
        {task.category && (
          <Badge variant="outline" style={{ borderColor: task.category.color, color: task.category.color }}>
            {task.category.name}
          </Badge>
        )}
        <Badge variant="secondary">{STATUS_LABELS[task.status] ?? task.status}</Badge>
        {day && (
          <span className="text-xs text-muted-foreground">
            {formatDayShort(day)}
            {task.scheduledTime ? `, ${task.scheduledTime}` : ""}
          </span>
        )}
      </div>

      <h2 className={cn("text-2xl font-semibold leading-tight", done && "text-muted-foreground line-through")}>
        {task.title}
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        {!done && <TimerButton task={task} onStatusChanged={revalidateTasks} />}
        <Button variant="outline" onClick={handleDone}>
          {done ? <RotateCcw className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4 text-green-600" />}
          {done ? "Przywróć" : "Gotowe"}
        </Button>
        <Button variant="ghost" asChild>
          <Link href={scheduleLink(task)}>
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Otwórz w harmonogramie
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground">plan {task.plannedMinutes || 25} min</span>
      </div>

      <EditableDescription
        key={task.id}
        taskId={task.id}
        initialValue={task.description}
        title={task.title}
        // Fresh snippet and order in the list next to it
        onSaved={() => mutate((key) => typeof key === "string" && key.startsWith("/api/tasks/notes"))}
        placeholder="Opis zadania…"
        contentClassName="min-h-[40vh] max-h-none text-[15px]"
      />

      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">Lista kontrolna</div>
        <SubtaskList taskId={task.id} subtasks={task.subtasks || []} onSubtasksChange={() => revalidateTasks()} />
      </div>
    </div>
  )
}
