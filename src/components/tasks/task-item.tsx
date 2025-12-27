"use client"

import { useState } from "react"
import { Check, Clock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TaskTimer } from "@/components/timer/task-timer"
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
        "group flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
        "hover:shadow-sm",
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
          "flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
          isDone
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground hover:border-primary"
        )}
      >
        {isDone && <Check className="h-3 w-3" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium truncate", isDone && "line-through")}>
            {task.title}
          </span>
          {task.category && (
            <Badge
              variant="outline"
              className="text-xs"
              style={{ borderColor: task.category.color, color: task.category.color }}
            >
              {task.category.name}
            </Badge>
          )}
        </div>

        {task.description && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {task.description}
          </p>
        )}

        {/* Time info */}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {task.scheduledTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.scheduledTime}
            </span>
          )}
          {(task.plannedMinutes || task.actualMinutes > 0) && (
            <span>
              {task.actualMinutes > 0 && formatMinutes(task.actualMinutes)}
              {task.plannedMinutes && (
                <span className="text-muted-foreground/60">
                  {task.actualMinutes > 0 ? " / " : ""}
                  {formatMinutes(task.plannedMinutes)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Timer */}
      {!isDone && (
        <TaskTimer
          taskId={task.id}
          compact
          onStop={(duration) => onTimeAdd(task.id, duration)}
        />
      )}

      {/* Actions */}
      {isHovered && (
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(task)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
