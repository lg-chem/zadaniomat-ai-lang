"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface QuickAddTaskProps {
  onAdd: (title: string) => void
  placeholder?: string
}

export function QuickAddTask({ onAdd, placeholder = "Dodaj nowe zadanie..." }: QuickAddTaskProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) {
      onAdd(title.trim())
      setTitle("")
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsAdding(false)
      setTitle("")
    }
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        aria-label="Dodaj nowe zadanie"
        className="flex items-center gap-2 w-full p-3 rounded-lg border border-dashed text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>{placeholder}</span>
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button type="submit" size="sm" disabled={!title.trim()}>
        Dodaj
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setIsAdding(false)
          setTitle("")
        }}
      >
        Anuluj
      </Button>
    </form>
  )
}
