"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownRight,
  ListChecks,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { quarterRequest } from "@/hooks/use-quarter"
import { cn } from "@/lib/utils"
import {
  daysBetween,
  dayKeyToLocalDate,
  formatDuration,
  type QuarterGoal,
  type QuarterPayload,
  type QuarterSprint,
  type SprintCommitment,
} from "@/lib/quarters"

interface CommitmentTask {
  id: string
  title: string
  status: string
  scheduledDate?: string | null
}

const shortDate = (key: string) => format(dayKeyToLocalDate(key), "d MMM", { locale: pl })

export function sprintStatusLabel(sprint: QuarterSprint, today: string): string {
  if (sprint.closedAt) return "Zamknięty"
  if (today < sprint.startKey) {
    const days = daysBetween(today, sprint.startKey)
    return days === 1 ? "Startuje jutro" : `Startuje za ${days} dni`
  }
  if (today > sprint.endKey) return "Zakończony, czeka na retro"
  const day = daysBetween(sprint.startKey, today) + 1
  const total = daysBetween(sprint.startKey, sprint.endKey) + 1
  return `Trwa · dzień ${day}/${total}`
}

function CommitmentTasks({ commitment, onChanged }: { commitment: SprintCommitment; onChanged: () => void }) {
  const { data: tasks = [], mutate } = useSWR<CommitmentTask[]>(`/api/goals/${commitment.id}/tasks`)
  const [title, setTitle] = useState("")

  const toggle = async (task: CommitmentTask) => {
    try {
      await quarterRequest(`/api/tasks/${task.id}`, "PATCH", {
        status: task.status === "COMPLETED" ? "NEW" : "COMPLETED",
      })
      await mutate()
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać zadania")
    }
  }

  const add = async () => {
    const value = title.trim()
    if (!value) return
    setTitle("")
    try {
      await quarterRequest(`/api/goals/${commitment.id}/tasks`, "POST", { title: value })
      await mutate()
      onChanged()
    } catch (error) {
      setTitle(value)
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać zadania")
    }
  }

  return (
    <div className="ml-7 mt-2 space-y-1.5 border-l-2 pl-3">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => toggle(task)}
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              task.status === "COMPLETED" ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"
            )}
            aria-label={task.status === "COMPLETED" ? "Oznacz jako niezrobione" : "Oznacz jako zrobione"}
          >
            {task.status === "COMPLETED" && <Check className="h-3 w-3" />}
          </button>
          <span className={cn("min-w-0 flex-1 truncate", task.status === "COMPLETED" && "text-muted-foreground line-through")}>
            {task.title}
          </span>
          {task.scheduledDate && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.scheduledDate), "d MMM", { locale: pl })}
            </span>
          )}
        </div>
      ))}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dodaj zadanie…"
          className="h-8 text-sm"
          aria-label="Nowe zadanie"
        />
        <Button type="submit" size="icon" variant="secondary" className="h-8 w-8 shrink-0" disabled={!title.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Dni zaplanujesz w{" "}
        <Link href="/schedule" className="underline underline-offset-2">
          Harmonogramie
        </Link>{" "}
        (sekcja „Cele sprintu” i stos zadań).
      </p>
    </div>
  )
}

function CommitmentRow({ commitment, onChanged }: { commitment: SprintCommitment; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const toggle = async () => {
    try {
      await quarterRequest(`/api/goals/${commitment.id}`, "PATCH", { isCompleted: !commitment.isCompleted })
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać")
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
            commitment.isCompleted ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"
          )}
          aria-label={commitment.isCompleted ? "Oznacz jako niezrobione" : "Oznacz jako zrobione"}
        >
          {commitment.isCompleted && <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted/60"
          aria-expanded={expanded}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              commitment.isCompleted && "text-muted-foreground line-through"
            )}
          >
            {commitment.title}
          </span>
          {commitment.carriedOver && !commitment.isCompleted && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <CornerDownRight className="h-3 w-3" /> przeniesione
            </span>
          )}
          {commitment.taskCount > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {commitment.completedTaskCount}/{commitment.taskCount} zadań
            </span>
          )}
          {commitment.trackedSeconds > 0 && (
            <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Clock className="h-3 w-3" />
              {formatDuration(commitment.trackedSeconds)}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </div>
      {expanded && <CommitmentTasks commitment={commitment} onChanged={onChanged} />}
    </div>
  )
}

function RetroSummary({ sprint }: { sprint: QuarterSprint }) {
  const retro = sprint.retrospective
  if (!retro) return null
  const columns = [
    { label: "Co zadziałało", items: retro.wentWell },
    { label: "Co nie zadziałało", items: retro.needsImprovement },
    { label: "Zmiana na kolejny sprint", items: retro.actionItems },
  ]
  return (
    <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-3">
      {columns.map((column) => (
        <div key={column.label}>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{column.label}</p>
          {column.items.length > 0 ? (
            <ul className="space-y-0.5 text-sm">
              {column.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      ))}
    </div>
  )
}

export function SprintPanel({
  quarter,
  sprint,
  today,
  onPlan,
  onClose,
  onChanged,
}: {
  quarter: QuarterPayload
  sprint: QuarterSprint
  today: string
  onPlan: (sprint: QuarterSprint) => void
  onClose: (sprint: QuarterSprint) => void
  onChanged: () => void
}) {
  const index = quarter.sprints.findIndex((s) => s.id === sprint.id)
  const previous = index > 0 ? quarter.sprints[index - 1] : null
  const previousChange = previous?.retrospective?.actionItems[0]
  const hasStarted = today >= sprint.startKey
  const hasEnded = today > sprint.endKey

  const done = sprint.commitments.filter((c) => c.isCompleted).length
  const tracked = sprint.commitments.reduce((sum, c) => sum + c.trackedSeconds, 0)

  const groups: { goal: QuarterGoal | null; items: SprintCommitment[] }[] = []
  for (const goal of quarter.goals) {
    const items = sprint.commitments.filter((c) => c.parentGoalId === goal.id)
    if (items.length > 0) groups.push({ goal, items })
  }
  const other = sprint.commitments.filter((c) => !quarter.goals.some((g) => g.id === c.parentGoalId))
  if (other.length > 0) groups.push({ goal: null, items: other })

  return (
    <Card>
      <CardHeader className="gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg">
            {sprint.name}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                sprint.closedAt
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : hasStarted && !hasEnded
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-secondary-foreground"
              )}
            >
              {sprintStatusLabel(sprint, today)}
            </span>
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {shortDate(sprint.startKey)} – {shortDate(sprint.endKey)}
            {sprint.commitments.length > 0 && (
              <>
                {" · "}
                {done}/{sprint.commitments.length} zobowiązań
                {tracked > 0 && ` · ${formatDuration(tracked)} pracy`}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            variant={sprint.plannedAt ? "outline" : "default"}
            onClick={() => onPlan(sprint)}
            disabled={quarter.goals.length === 0}
          >
            <ListChecks className="mr-1.5 h-4 w-4" />
            {sprint.plannedAt ? "Edytuj plan" : "Zaplanuj sprint"}
          </Button>
          {hasStarted && (
            <Button
              size="sm"
              variant={hasEnded && !sprint.closedAt ? "default" : "outline"}
              onClick={() => onClose(sprint)}
            >
              {sprint.closedAt ? "Edytuj retro" : "Zamknij sprint"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {previousChange && !sprint.closedAt && (
          <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              <span className="font-medium">Zmiana z retro {previous?.name}:</span> {previousChange}
            </p>
          </div>
        )}

        {sprint.sprintGoal && (
          <div className="flex gap-3">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cel sprintu</p>
              <p className="font-medium">{sprint.sprintGoal}</p>
            </div>
          </div>
        )}

        {groups.length > 0 ? (
          <div className="space-y-4">
            {groups.map(({ goal, items }) => (
              <div key={goal?.id ?? "other"} className="space-y-1.5">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: goal?.category?.color ?? "hsl(var(--muted-foreground))" }}
                  />
                  {goal ? goal.title : "Poza celami kwartału"}
                </p>
                {items.map((commitment) => (
                  <CommitmentRow key={commitment.id} commitment={commitment} onChanged={onChanged} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          !sprint.closedAt && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {quarter.goals.length === 0
                ? "Najpierw dodaj cele kwartału. Sprint rozpisuje je na konkretne zobowiązania."
                : "Ten sprint nie ma jeszcze planu. Wybierz jeden cel sprintu i 3–5 zobowiązań."}
            </div>
          )
        )}

        {sprint.closedAt && <RetroSummary sprint={sprint} />}
      </CardContent>
    </Card>
  )
}
