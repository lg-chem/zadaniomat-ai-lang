"use client"

import { memo, useState } from "react"
import Link from "next/link"
import { Calendar, Check, ListChecks, Plus, StickyNote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { isTempTaskId, type GoalTaskActions } from "@/hooks/use-goal-tasks"
import { isEmptyRichText } from "@/lib/rich-text"
import { localDayKey, taskDayKey, type GoalTaskItem } from "@/lib/quarters"
import { cn } from "@/lib/utils"
import { GoalTaskDialog } from "./goal-task-dialog"
import { dayLabel, TaskDayPicker } from "./task-day-picker"

export const hasTaskNote = (task: GoalTaskItem) => !!task.linkedNote || !isEmptyRichText(task.description)

const GoalTaskRow = memo(function GoalTaskRow({
  task,
  today,
  actions,
  onOpen,
}: {
  task: GoalTaskItem
  today: string
  actions: GoalTaskActions
  onOpen: (taskId: string) => void
}) {
  const done = task.status === "COMPLETED"
  const saving = isTempTaskId(task.id)
  const dayKey = taskDayKey(task)
  const overdue = !!dayKey && !done && dayKey < today
  const withNote = hasTaskNote(task)
  const checked = task.subtasks.filter((s) => s.isCompleted).length

  return (
    <div className={cn("flex min-h-8 items-center gap-2 text-sm", saving && "opacity-70")} data-goal-task-id={task.id}>
      <button
        type="button"
        onClick={() => actions.toggle(task)}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-foreground"
        )}
        aria-label={done ? "Oznacz jako niezrobione" : "Oznacz jako zrobione"}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        disabled={saving}
        className={cn(
          "min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left hover:bg-muted/60",
          done && "text-muted-foreground line-through"
        )}
        title={task.title}
      >
        {task.title}
      </button>
      {task.subtasks.length > 0 && (
        <span className="hidden shrink-0 items-center gap-0.5 text-xs text-muted-foreground sm:flex">
          <ListChecks className="h-3 w-3" />
          {checked}/{task.subtasks.length}
        </span>
      )}
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        disabled={saving}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-muted",
          withNote ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/50 hover:text-foreground"
        )}
        aria-label={withNote ? "Notatka zadania" : "Dodaj notatkę"}
        title={task.linkedNote ? `Notatka: ${task.linkedNote.title}` : withNote ? "Notatka zadania" : "Dodaj notatkę"}
      >
        <StickyNote className={cn("h-3.5 w-3.5", withNote && "fill-amber-100 dark:fill-amber-950")} />
      </button>
      {(dayKey || !done) && (
        <TaskDayPicker dayKey={dayKey} onSelect={(key) => actions.schedule(task, key)} taskId={saving ? undefined : task.id}>
          <button
            type="button"
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2 text-xs transition-colors hover:bg-muted",
              !dayKey && "border-dashed text-muted-foreground",
              dayKey && !overdue && "border-primary/30 bg-primary/5 text-primary",
              overdue && "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
              done && "border-transparent bg-transparent text-muted-foreground"
            )}
            aria-label={dayKey ? `W harmonogramie: ${dayLabel(dayKey, today)}. Zmień dzień` : "Zaplanuj w harmonogramie"}
          >
            <Calendar className="h-3 w-3" />
            {dayKey ? dayLabel(dayKey, today) : "Zaplanuj"}
          </button>
        </TaskDayPicker>
      )}
    </div>
  )
})

function AddGoalTask({ goalId, actions }: { goalId: string; actions: GoalTaskActions }) {
  const [title, setTitle] = useState("")
  // Kept after adding - handy for a few tasks for the same day
  const [dayKey, setDayKey] = useState<string | null>(null)

  const submit = () => {
    const value = title.trim()
    if (!value) return
    setTitle("")
    actions.add(goalId, value, dayKey)
  }

  return (
    <form
      className="flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Dodaj zadanie…"
        className="h-8 min-w-0 text-sm"
        aria-label="Nowe zadanie"
      />
      <TaskDayPicker dayKey={dayKey} onSelect={setDayKey} emptyLabel="Bez dnia">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 shrink-0 gap-1 px-2 text-xs", dayKey ? "text-primary" : "text-muted-foreground")}
          aria-label={dayKey ? `Dzień w harmonogramie: ${dayLabel(dayKey)}` : "Dzień w harmonogramie: bez dnia"}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{dayKey ? dayLabel(dayKey) : "Bez dnia"}</span>
          <span className="sm:hidden">{dayKey ? dayLabel(dayKey) : ""}</span>
        </Button>
      </TaskDayPicker>
      <Button type="submit" size="icon" variant="secondary" className="h-8 w-8 shrink-0" disabled={!title.trim()} aria-label="Dodaj zadanie">
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  )
}

/**
 * Tasks of a goal / commitment: done, day in Harmonogram, note.
 * A click shows at once, saving happens in the background.
 */
export function GoalTaskList({
  goalId,
  tasks,
  isLoaded,
  actions,
  contextLabel,
  className,
}: {
  goalId: string
  tasks: GoalTaskItem[]
  isLoaded: boolean
  actions: GoalTaskActions
  // Shown above the task title in the task window, e.g. the commitment
  contextLabel?: string
  className?: string
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const today = localDayKey()
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null

  return (
    <div className={cn("space-y-1", className)}>
      {!isLoaded && tasks.length === 0 ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ) : (
        tasks.map((task) => (
          <GoalTaskRow key={task.id} task={task} today={today} actions={actions} onOpen={setOpenTaskId} />
        ))
      )}
      <div className="pt-1">
        <AddGoalTask goalId={goalId} actions={actions} />
      </div>
      <p className="pt-0.5 text-xs text-muted-foreground">
        Zadanie z dniem trafia do{" "}
        <Link href="/schedule" prefetch={false} className="underline underline-offset-2">
          Harmonogramu
        </Link>
        . <StickyNote className="inline h-3 w-3 align-[-2px]" /> notatka do zadania albo podpięta z{" "}
        <Link href="/notes" prefetch={false} className="underline underline-offset-2">
          Notatek
        </Link>
        .
      </p>
      <GoalTaskDialog
        task={openTask}
        contextLabel={contextLabel}
        actions={actions}
        onOpenChange={(open) => !open && setOpenTaskId(null)}
      />
    </div>
  )
}
