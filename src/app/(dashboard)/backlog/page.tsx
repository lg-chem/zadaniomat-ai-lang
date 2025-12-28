"use client"

import { useState, useRef, KeyboardEvent } from "react"
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
  MessageSquare,
  CalendarPlus,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBacklog } from "@/hooks/use-backlog"
import { useCategories } from "@/hooks/use-categories"
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
  const router = useRouter()
  const [showProcessed, setShowProcessed] = useState(false)
  const { workspace } = useWorkspaceStore()

  // Use SWR hook for data fetching with cache
  const { items, isLoading, mutate } = useBacklog({ showProcessed })
  const { categories } = useCategories()

  // Quick add
  const [newContent, setNewContent] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")

  // AI Discussion dialog
  const [discussingItem, setDiscussingItem] = useState<BacklogItem | null>(null)
  const [aiResponse, setAiResponse] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  // Convert to task dialog
  const [convertingItem, setConvertingItem] = useState<BacklogItem | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: "",
    categoryId: "",
    plannedMinutes: "25",
    scheduledDate: format(new Date(), "yyyy-MM-dd"),
  })

  const handleCreate = async () => {
    if (!newContent.trim()) return

    try {
      const res = await fetch("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newContent,
          workspaceType: "WORK", // Get from store if needed
        }),
      })
      if (res.ok) {
        mutate() // SWR will refetch data
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
      mutate() // SWR will refetch data
      setEditingId(null)
    } catch (error) {
      console.error("Error updating item:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten element?")) return
    try {
      await fetch(`/api/backlog/${id}`, { method: "DELETE" })
      mutate() // SWR will refetch data
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

  // Continue discussion in main AI chat
  const handleContinueToChat = (item: BacklogItem) => {
    // Store the context in sessionStorage for AI chat to pick up
    sessionStorage.setItem("aiChatContext", JSON.stringify({
      type: "backlog_discussion",
      content: item.content,
      aiResponse: aiResponse,
    }))
    setDiscussingItem(null)
    router.push("/ai")
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

  // AI Discussion
  const handleDiscuss = async (item: BacklogItem) => {
    setDiscussingItem(item)
    setAiResponse("")
    setAiLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Przeanalizuj ten pomysł z backlogu i pomóż mi zdecydować co z nim zrobić. Pomysł: "${item.content}". Podaj konkretne sugestie: czy to warto realizować, jak podzielić na zadania, jaki priorytet nadać.`,
          mode: "daily_tasks",
          history: [],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setAiResponse(data.message || "Nie udało się uzyskać odpowiedzi.")
      } else {
        setAiResponse("Błąd: Upewnij się, że GEMINI_API_KEY jest skonfigurowany.")
      }
    } catch (error) {
      console.error("Error discussing with AI:", error)
      setAiResponse("Wystąpił błąd podczas komunikacji z AI.")
    } finally {
      setAiLoading(false)
    }
  }

  // Convert to task
  const handleStartConvert = (item: BacklogItem) => {
    setConvertingItem(item)
    setTaskForm({
      title: item.content,
      categoryId: "",
      plannedMinutes: "25",
      scheduledDate: format(new Date(), "yyyy-MM-dd"),
    })
  }

  const handleConvertToTask = async () => {
    if (!taskForm.title.trim() || !convertingItem) return

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title,
          categoryId: taskForm.categoryId || undefined,
          plannedMinutes: parseInt(taskForm.plannedMinutes) || 25,
          scheduledDate: taskForm.scheduledDate,
          workspaceType: workspace,
          status: "NEW",
        }),
      })

      if (res.ok) {
        // Mark backlog item as processed
        await handleUpdate(convertingItem.id, { isProcessed: true })
        setConvertingItem(null)
        setTaskForm({
          title: "",
          categoryId: "",
          plannedMinutes: "25",
          scheduledDate: format(new Date(), "yyyy-MM-dd"),
        })
      }
    } catch (error) {
      console.error("Error converting to task:", error)
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Backlog</h1>
          <p className="text-sm md:text-base text-muted-foreground">
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
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
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
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleDiscuss(item)}
                        title="Przedyskutuj z AI"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleStartConvert(item)}
                        title="Zamień na zadanie"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleMarkProcessed(item.id)}
                        title="Oznacz jako przetworzone"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      </Button>
                    </>
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

      {/* AI Discussion Dialog */}
      <Dialog open={!!discussingItem} onOpenChange={(open) => !open && setDiscussingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Dyskusja z AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Pomysł z backlogu:</div>
              <div className="font-medium">{discussingItem?.content}</div>
            </div>

            {aiLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Analizuję...</span>
              </div>
            ) : aiResponse ? (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="text-sm text-muted-foreground mb-2">Odpowiedź AI:</div>
                <div className="whitespace-pre-wrap text-sm">{aiResponse}</div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            {discussingItem && !aiLoading && aiResponse && (
              <>
                <Button
                  variant="default"
                  onClick={() => handleContinueToChat(discussingItem)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Kontynuuj w czacie AI
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStartConvert(discussingItem)}
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Zamień na zadanie
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setDiscussingItem(null)}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Task Dialog */}
      <Dialog open={!!convertingItem} onOpenChange={(open) => !open && setConvertingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Zamień na zadanie
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Tytuł zadania</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              />
            </div>

            <div>
              <Label>Kategoria</Label>
              <Select
                value={taskForm.categoryId || "none"}
                onValueChange={(v) => setTaskForm({ ...taskForm, categoryId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak kategorii</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Planowany czas (min)</Label>
                <Input
                  type="number"
                  value={taskForm.plannedMinutes}
                  onChange={(e) => setTaskForm({ ...taskForm, plannedMinutes: e.target.value })}
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={taskForm.scheduledDate}
                  onChange={(e) => setTaskForm({ ...taskForm, scheduledDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertingItem(null)}>
              Anuluj
            </Button>
            <Button onClick={handleConvertToTask} disabled={!taskForm.title.trim()}>
              <Check className="h-4 w-4 mr-2" />
              Utwórz zadanie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
