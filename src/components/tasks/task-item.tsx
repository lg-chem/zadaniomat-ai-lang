"use client"

import { useState } from "react"
import { Check, Clock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TaskTimer } from "@/components/timer/task-timer"
import { SubtaskProgress, Subtask } from "./subtask-list"
import { cn } from "@/lib/utils"

interface Category {
  id: string
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: number
  plannedMinutes?: number | null
  actualMinutes: number
  scheduledTime?: string | null
  category?: Category | null
  subtasks?: Subtask[]
}

interface TaskItemProps {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onTimeAdd: (id: string, duration: number) => void
  onEdit?: (task: Task) => void
  onDelete?: (id: string) => void
}

const priorityColors = {
  0: "",
  1: "border-l-green-500",
  2: "border-l-yellow-500",
  3: "border-l-red-500",
}

export function TaskItem({ task, onStatusChange, onTimeAdd, onEdit, onDelete }: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const isDone = task.status === "DONE"

  const handleToggle = () => {
    onStatusChange(task.id, isDone ? "TODO" : "DONE")
  }

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-2 md:gap-3 p-2.5 md:p-3 rounded-lg border bg-card transition-all",
        "hover:shadow-sm active:shadow-sm",
        task.priority > 0 && `border-l-4 ${priorityColors[task.priority as keyof typeof priorityColors]}`,
        isDone && "opacity-60"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className={cn(
          "flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors touch-manipulation mt-0.5",
          isDone
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground hover:border-primary active:border-primary"
        )}
      >
        {isDone && <Check className="h-3 w-3" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className={cn("font-medium text-sm md:text-base break-words", isDone && "line-through")}>
            {task.title}
          </span>
          {task.category && (
            <Badge
              variant="outline"
              className="text-[10px] md:text-xs flex-shrink-0 w-fit"
              style={{ borderColor: task.category.color, color: task.category.color }}
            >
              {task.category.name}
            </Badge>
          )}
        </div>

        {task.description && (
          <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {task.description}
          </p>
        )}

        {/* Time info and subtask progress */}
        <div className="flex items-center gap-2 md:gap-3 mt-1 text-[10px] md:text-xs text-muted-foreground flex-wrap">
          {task.scheduledTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 flex-shrink-0" />
              {task.scheduledTime}
            </span>
          )}
          {(task.plannedMinutes || task.actualMinutes > 0) && (
            <span className="whitespace-nowrap">
              {task.actualMinutes > 0 && formatMinutes(task.actualMinutes)}
              {task.plannedMinutes && (
                <span className="text-muted-foreground/60">
                  {task.actualMinutes > 0 ? " / " : ""}
                  {formatMinutes(task.plannedMinutes)}
                </span>
              )}
            </span>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <SubtaskProgress subtasks={task.subtasks} />
          )}
        </div>
      </div>

      {/* Timer and Actions */}
      <div className="flex flex-col md:flex-row items-end md:items-center gap-1 flex-shrink-0">
        {/* Timer */}
        {!isDone && (
          <TaskTimer
            taskId={task.id}
            compact
            onStop={(duration) => onTimeAdd(task.id, duration)}
          />
        )}

        {/* Actions - show on mobile always, on desktop on hover */}
        <div className={cn(
          "flex items-center gap-0.5",
          "md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        )}>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 touch-manipulation"
              onClick={() => onEdit(task)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 text-destructive hover:text-destructive touch-manipulation"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
