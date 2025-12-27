"use client"

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Check,
  Trash2,
  X,
  Inbox,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useWorkspaceStore } from "@/stores/workspace-store"

interface BacklogItem {
  id: string
  content: string
  priority: number
  isProcessed: boolean
  processedAt?: string | null
  createdAt: string
}

export default function BacklogPage() {
  const { workspace } = useWorkspaceStore()
  const [items, setItems] = useState<BacklogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showProcessed, setShowProcessed] = useState(false)

  // Quick add
  const [newContent, setNewContent] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/backlog?workspace=${workspace}&showProcessed=${showProcessed}`
      )
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch (error) {
      console.error("Error fetching backlog:", error)
    } finally {
      setIsLoading(false)
    }
  }, [workspace, showProcessed])

  useEffect(() => {
    setIsLoading(true)
    fetchItems()
  }, [fetchItems])

  const handleCreate = async () => {
    if (!newContent.trim()) return

    try {
      const res = await fetch("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newContent,
          workspaceType: workspace,
        }),
      })
      if (res.ok) {
        fetchItems()
        setNewContent("")
        setIsAdding(false)
      }
    } catch (error) {
      console.error("Error creating item:", error)
    }
  }

  const handleUpdate = async (id: string, data: Partial<BacklogItem>) => {
    try {
      await fetch(`/api/backlog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      fetchItems()
      setEditingId(null)
    } catch (error) {
      console.error("Error updating item:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten element?")) return
    try {
      await fetch(`/api/backlog/${id}`, { method: "DELETE" })
      fetchItems()
    } catch (error) {
      console.error("Error deleting item:", error)
    }
  }

  const handleMarkProcessed = async (id: string) => {
    await handleUpdate(id, { isProcessed: true })
  }

  const handleChangePriority = async (id: string, delta: number) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    await handleUpdate(id, { priority: Math.max(0, item.priority + delta) })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
    if (e.key === "Escape") {
      setIsAdding(false)
      setEditingId(null)
      setNewContent("")
    }
  }

  const handleAddClick = () => {
    setIsAdding(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleStartEdit = (item: BacklogItem) => {
    setEditingId(item.id)
    setEditingContent(item.content)
  }

  const handleSaveEdit = () => {
    if (editingId && editingContent.trim()) {
      handleUpdate(editingId, { content: editingContent })
    } else {
      setEditingId(null)
    }
  }

  // Stats
  const activeCount = items.filter((i) => !i.isProcessed).length
  const highPriorityCount = items.filter((i) => i.priority > 0 && !i.isProcessed).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backlog</h1>
          <p className="text-muted-foreground">
            Szybkie zapisywanie pomysłów i zadań do przetworzenia
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={showProcessed}
              onCheckedChange={setShowProcessed}
            />
            <span className="text-sm text-muted-foreground">Pokaż przetworzone</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <div className="text-sm text-muted-foreground">Do przetworzenia</div>
            <div className="text-2xl font-bold">{activeCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Wysoki priorytet</div>
            <div className="text-2xl font-bold text-orange-500">{highPriorityCount}</div>
          </div>
        </CardContent>
      </Card>

      {/* Backlog List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Lista pomysłów
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_100px_120px] gap-2 p-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
              <div>Treść</div>
              <div className="text-center">Priorytet</div>
              <div>Akcje</div>
            </div>

            {/* Items */}
            {items.map((item) => (
              <div
                key={item.id}
                className={`grid grid-cols-[1fr_100px_120px] gap-2 p-3 border-b last:border-b-0 items-center transition-colors ${
                  item.isProcessed ? "bg-muted/30 opacity-60" : "hover:bg-muted/20"
                }`}
              >
                {/* Content */}
                <div>
                  {editingId === item.id ? (
                    <Input
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                      onBlur={handleSaveEdit}
                      className="h-8"
                      autoFocus
                    />
                  ) : (
                    <div
                      className={`cursor-text px-2 py-1 rounded hover:bg-muted transition-colors ${
                        item.isProcessed ? "line-through" : ""
                      }`}
                      onClick={() => !item.isProcessed && handleStartEdit(item)}
                    >
                      <div className="flex items-center gap-2">
                        {item.priority > 0 && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              item.priority >= 2 ? "bg-orange-100 text-orange-700" : ""
                            }`}
                          >
                            P{item.priority}
                          </Badge>
                        )}
                        <span>{item.content}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.createdAt), "d MMM yyyy, HH:mm", { locale: pl })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Priority buttons */}
                <div className="flex justify-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleChangePriority(item.id, 1)}
                    disabled={item.isProcessed}
                    title="Zwiększ priorytet"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleChangePriority(item.id, -1)}
                    disabled={item.isProcessed || item.priority === 0}
                    title="Zmniejsz priorytet"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!item.isProcessed && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleMarkProcessed(item.id)}
                      title="Oznacz jako przetworzone"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDelete(item.id)}
                    title="Usuń"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add New Item */}
            {isAdding ? (
              <div className="grid grid-cols-[1fr_100px_120px] gap-2 p-3 items-center bg-primary/5">
                <div>
                  <Input
                    ref={inputRef}
                    placeholder="Wpisz pomysł, zadanie, notatkę..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleCreate)}
                    className="h-8"
                  />
                </div>
                <div />
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCreate}
                    disabled={!newContent.trim()}
                  >
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setIsAdding(false)
                      setNewContent("")
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleAddClick}
                className="w-full p-3 text-left text-muted-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Dodaj pomysł...
              </button>
            )}
          </div>

          {/* Empty state */}
          {items.length === 0 && !isAdding && (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Backlog jest pusty</p>
              <p className="text-sm">Kliknij "Dodaj pomysł" aby zapisać nową ideę</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
