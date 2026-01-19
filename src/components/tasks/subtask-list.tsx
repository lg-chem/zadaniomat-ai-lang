"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
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
  // Local state for immediate UI updates
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(subtasks)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Sync local state with prop when it changes from outside
  useEffect(() => {
    setLocalSubtasks(subtasks)
  }, [subtasks])

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

    // Optimistic add with temp ID
    const tempId = `temp-${Date.now()}`
    const tempSubtask: Subtask = {
      id: tempId,
      title: newSubtaskTitle.trim(),
      isCompleted: false,
      order: localSubtasks.length,
    }
    const optimisticSubtasks = [...localSubtasks, tempSubtask]
    setLocalSubtasks(optimisticSubtasks)
    setNewSubtaskTitle("")

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtaskTitle.trim() }),
      })

      if (res.ok) {
        const newSubtask = await res.json()
        // Replace temp with real subtask
        const finalSubtasks = optimisticSubtasks.map(s =>
          s.id === tempId ? newSubtask : s
        )
        setLocalSubtasks(finalSubtasks)
        onSubtasksChange(finalSubtasks)
      } else {
        // Revert on API error (4xx, 5xx)
        console.error("Error adding subtask: API returned", res.status)
        setLocalSubtasks(localSubtasks)
      }
    } catch (error) {
      console.error("Error adding subtask:", error)
      // Revert on network error
      setLocalSubtasks(localSubtasks)
    }
  }

  const handleToggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    // Optimistic update - immediate UI response
    const updatedSubtasks = localSubtasks.map(s =>
      s.id === subtaskId ? { ...s, isCompleted } : s
    )
    setLocalSubtasks(updatedSubtasks)

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      })
      if (res.ok) {
        // Notify parent after successful save
        onSubtasksChange(updatedSubtasks)
      } else {
        // Revert on API error
        console.error("Error toggling subtask: API returned", res.status)
        setLocalSubtasks(localSubtasks)
      }
    } catch (error) {
      console.error("Error toggling subtask:", error)
      // Revert on network error
      setLocalSubtasks(localSubtasks)
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    // Optimistic update
    const updatedSubtasks = localSubtasks.filter(s => s.id !== subtaskId)
    setLocalSubtasks(updatedSubtasks)

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        onSubtasksChange(updatedSubtasks)
      } else {
        // Revert on API error
        console.error("Error deleting subtask: API returned", res.status)
        setLocalSubtasks(localSubtasks)
      }
    } catch (error) {
      console.error("Error deleting subtask:", error)
      // Revert on network error
      setLocalSubtasks(localSubtasks)
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
    const updatedSubtasks = localSubtasks.map(s =>
      s.id === editingId ? { ...s, title: editingTitle.trim() } : s
    )
    setLocalSubtasks(updatedSubtasks)
    setEditingId(null)

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle.trim() }),
      })
      if (res.ok) {
        onSubtasksChange(updatedSubtasks)
      } else {
        // Revert on API error
        console.error("Error updating subtask: API returned", res.status)
        setLocalSubtasks(localSubtasks)
      }
    } catch (error) {
      console.error("Error updating subtask:", error)
      // Revert on network error
      setLocalSubtasks(localSubtasks)
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

  const completedCount = localSubtasks.filter(s => s.isCompleted).length
  const totalCount = localSubtasks.length
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
        {localSubtasks.map((subtask) => (
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
