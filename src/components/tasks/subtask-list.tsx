"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface Subtask {
  id: string
  title: string
  isCompleted: boolean
  order: number
}

interface SubtaskListProps {
  taskId: string
  subtasks: Subtask[]
  onSubtasksChange: (subtasks: Subtask[]) => void
  readOnly?: boolean
}

export function SubtaskList({ taskId, subtasks, onSubtasksChange, readOnly = false }: SubtaskListProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtaskTitle.trim() }),
      })

      if (res.ok) {
        const newSubtask = await res.json()
        onSubtasksChange([...subtasks, newSubtask])
        setNewSubtaskTitle("")
      }
    } catch (error) {
      console.error("Error adding subtask:", error)
    }
  }

  const handleToggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    // Optimistic update
    const updatedSubtasks = subtasks.map(s =>
      s.id === subtaskId ? { ...s, isCompleted } : s
    )
    onSubtasksChange(updatedSubtasks)

    try {
      await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      })
    } catch (error) {
      console.error("Error toggling subtask:", error)
      // Revert on error
      onSubtasksChange(subtasks)
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    // Optimistic update
    const updatedSubtasks = subtasks.filter(s => s.id !== subtaskId)
    onSubtasksChange(updatedSubtasks)

    try {
      await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "DELETE",
      })
    } catch (error) {
      console.error("Error deleting subtask:", error)
      // Revert on error
      onSubtasksChange(subtasks)
    }
  }

  const handleStartEdit = (subtask: Subtask) => {
    setEditingId(subtask.id)
    setEditingTitle(subtask.title)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null)
      return
    }

    // Optimistic update
    const updatedSubtasks = subtasks.map(s =>
      s.id === editingId ? { ...s, title: editingTitle.trim() } : s
    )
    onSubtasksChange(updatedSubtasks)
    setEditingId(null)

    try {
      await fetch(`/api/tasks/${taskId}/subtasks/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle.trim() }),
      })
    } catch (error) {
      console.error("Error updating subtask:", error)
      // Revert on error
      onSubtasksChange(subtasks)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    } else if (e.key === "Escape") {
      setEditingId(null)
      setIsAdding(false)
      setNewSubtaskTitle("")
    }
  }

  const completedCount = subtasks.filter(s => s.isCompleted).length
  const totalCount = subtasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Progress header */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{completedCount}/{totalCount} ukończone</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{progress}%</span>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group transition-colors",
              subtask.isCompleted && "opacity-60"
            )}
          >
            <Checkbox
              checked={subtask.isCompleted}
              onCheckedChange={(checked) => handleToggleSubtask(subtask.id, checked as boolean)}
              disabled={readOnly}
            />

            {editingId === subtask.id ? (
              <Input
                ref={editInputRef}
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                className="flex-1 h-7 text-sm"
              />
            ) : (
              <span
                className={cn(
                  "flex-1 text-sm cursor-pointer",
                  subtask.isCompleted && "line-through text-muted-foreground"
                )}
                onClick={() => !readOnly && handleStartEdit(subtask)}
              >
                {subtask.title}
              </span>
            )}

            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={() => handleDeleteSubtask(subtask.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add new subtask */}
      {!readOnly && (
        <div className="pt-1">
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleAddSubtask)}
                placeholder="Nowy punkt..."
                className="flex-1 h-8 text-sm"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddSubtask}
                disabled={!newSubtaskTitle.trim()}
              >
                Dodaj
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false)
                  setNewSubtaskTitle("")
                }}
              >
                Anuluj
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj punkt do listy
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Progress indicator for task items (compact version)
export function SubtaskProgress({ subtasks }: { subtasks: Subtask[] }) {
  if (!subtasks || subtasks.length === 0) return null

  const completedCount = subtasks.filter(s => s.isCompleted).length
  const totalCount = subtasks.length
  const progress = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground">
      <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            progress === 100 ? "bg-green-500" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span>{completedCount}/{totalCount}</span>
    </div>
  )
}
