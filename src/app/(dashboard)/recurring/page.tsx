"use client"

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Check,
  Trash2,
  X,
  Repeat,
  Clock,
  Calendar,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useWorkspaceStore } from "@/stores/workspace-store"

interface Category {
  id: string
  name: string
  color: string
}

interface RecurringTask {
  id: string
  title: string
  description?: string | null
  scheduledDate?: string | null
  scheduledTime?: string | null
  plannedMinutes?: number | null
  recurrenceRule: string
  priority: number
  category?: Category | null
  workspaceType: string
}

const RECURRENCE_OPTIONS = [
  { value: "DAILY", label: "Codziennie" },
  { value: "WEEKLY", label: "Co tydzień" },
  { value: "WEEKDAYS", label: "Dni robocze (pon-pt)" },
  { value: "MONTHLY", label: "Co miesiąc" },
  { value: "SPRINT_END_7", label: "7 dni przed końcem sprintu" },
  { value: "SPRINT_END_3", label: "3 dni przed końcem sprintu" },
  { value: "SPRINT_END_1", label: "Dzień przed końcem sprintu" },
  { value: "PERIOD_END_14", label: "14 dni przed końcem okresu" },
  { value: "PERIOD_END_7", label: "7 dni przed końcem okresu" },
]

const PRIORITY_OPTIONS = [
  { value: 0, label: "Brak", color: "bg-muted" },
  { value: 1, label: "Niski", color: "bg-blue-500" },
  { value: 2, label: "Średni", color: "bg-yellow-500" },
  { value: 3, label: "Wysoki", color: "bg-red-500" },
]

export default function RecurringPage() {
  const [tasks, setTasks] = useState<RecurringTask[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { workspace } = useWorkspaceStore()

  // New recurring task form
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    recurrenceRule: "DAILY",
    scheduledTime: "",
    plannedMinutes: "",
    priority: 0,
    categoryId: "",
  })

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/recurring?workspace=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (error) {
      console.error("Error fetching recurring tasks:", error)
    } finally {
      setIsLoading(false)
    }
  }, [workspace])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/categories?workspace=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }, [workspace])

  useEffect(() => {
    setIsLoading(true)
    fetchTasks()
    fetchCategories()
  }, [fetchTasks, fetchCategories])

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !newTask.recurrenceRule) return

    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTask,
          workspace,
          plannedMinutes: newTask.plannedMinutes ? parseInt(newTask.plannedMinutes) : null,
        }),
      })
      if (res.ok) {
        fetchTasks()
        setNewTask({
          title: "",
          description: "",
          recurrenceRule: "DAILY",
          scheduledTime: "",
          plannedMinutes: "",
          priority: 0,
          categoryId: "",
        })
        setIsDialogOpen(false)
      }
    } catch (error) {
      console.error("Error creating recurring task:", error)
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie cykliczne?")) return
    try {
      await fetch(`/api/recurring/${id}`, { method: "DELETE" })
      fetchTasks()
    } catch (error) {
      console.error("Error deleting recurring task:", error)
    }
  }

  const handleToggleActive = async (task: RecurringTask) => {
    try {
      await fetch(`/api/recurring/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRecurring: true }),
      })
      fetchTasks()
    } catch (error) {
      console.error("Error toggling task:", error)
    }
  }

  const getRecurrenceLabel = (rule: string) => {
    const option = RECURRENCE_OPTIONS.find(o => o.value === rule)
    return option?.label || rule
  }

  const getPriorityOption = (priority: number) => {
    return PRIORITY_OPTIONS.find(o => o.value === priority) || PRIORITY_OPTIONS[0]
  }

  // Group tasks by recurrence type
  const groupedTasks = tasks.reduce((acc, task) => {
    const rule = task.recurrenceRule
    if (!acc[rule]) acc[rule] = []
    acc[rule].push(task)
    return acc
  }, {} as Record<string, RecurringTask[]>)

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
          <h1 className="text-3xl font-bold">Zadania Cykliczne</h1>
          <p className="text-muted-foreground">
            Zarządzaj zadaniami, które powtarzają się regularnie
          </p>
        </div>

        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nowe zadanie cykliczne
        </Button>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">Zadania cykliczne</div>
              <div className="text-2xl font-bold">{tasks.length}</div>
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Codzienne</div>
            <div className="text-2xl font-bold">{tasks.filter(t => t.recurrenceRule === "DAILY").length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Tygodniowe</div>
            <div className="text-2xl font-bold">{tasks.filter(t => t.recurrenceRule === "WEEKLY").length}</div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks by Category */}
      {Object.entries(groupedTasks).map(([rule, ruleTasks]) => (
        <Card key={rule}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              {getRecurrenceLabel(rule)}
              <Badge variant="secondary">{ruleTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_150px_100px_100px_50px] gap-2 p-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
                <div>Zadanie</div>
                <div>Kategoria</div>
                <div className="text-center">Czas</div>
                <div className="text-center">Priorytet</div>
                <div></div>
              </div>

              {/* Task Rows */}
              {ruleTasks.map((task) => {
                const priorityOption = getPriorityOption(task.priority)
                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[1fr_150px_100px_100px_50px] gap-2 p-3 border-b last:border-b-0 items-center hover:bg-muted/20"
                  >
                    {/* Task Info */}
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground truncate">
                          {task.description}
                        </div>
                      )}
                      {task.scheduledTime && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {task.scheduledTime}
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <div>
                      {task.category ? (
                        <Badge
                          variant="outline"
                          style={{ borderColor: task.category.color, color: task.category.color }}
                        >
                          {task.category.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </div>

                    {/* Time */}
                    <div className="text-center">
                      {task.plannedMinutes ? (
                        <span className="text-sm">{task.plannedMinutes} min</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>

                    {/* Priority */}
                    <div className="flex justify-center">
                      <Badge className={`${priorityOption.color} text-white text-[10px]`}>
                        {priorityOption.label}
                      </Badge>
                    </div>

                    {/* Delete */}
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Brak zadań cyklicznych</p>
          <p className="text-sm">Kliknij "Nowe zadanie cykliczne" aby dodać</p>
        </div>
      )}

      {/* Add Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nowe zadanie cykliczne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nazwa zadania</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="np. Codzienny raport"
              />
            </div>

            <div>
              <Label>Opis (opcjonalnie)</Label>
              <Input
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Szczegóły zadania..."
              />
            </div>

            <div>
              <Label>Powtarzalność</Label>
              <Select
                value={newTask.recurrenceRule}
                onValueChange={(v) => setNewTask({ ...newTask, recurrenceRule: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newTask.recurrenceRule.includes("SPRINT") && (
                <p className="text-xs text-muted-foreground mt-1">
                  Zadanie pojawi się automatycznie przed końcem aktywnego sprintu
                </p>
              )}
              {newTask.recurrenceRule.includes("PERIOD") && (
                <p className="text-xs text-muted-foreground mt-1">
                  Zadanie pojawi się automatycznie przed końcem aktywnego okresu
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Godzina (opcjonalnie)</Label>
                <Input
                  type="time"
                  value={newTask.scheduledTime}
                  onChange={(e) => setNewTask({ ...newTask, scheduledTime: e.target.value })}
                />
              </div>
              <div>
                <Label>Czas trwania (min)</Label>
                <Input
                  type="number"
                  value={newTask.plannedMinutes}
                  onChange={(e) => setNewTask({ ...newTask, plannedMinutes: e.target.value })}
                  placeholder="np. 30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategoria</Label>
                <Select
                  value={newTask.categoryId}
                  onValueChange={(v) => setNewTask({ ...newTask, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Brak</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorytet</Label>
                <Select
                  value={newTask.priority.toString()}
                  onValueChange={(v) => setNewTask({ ...newTask, priority: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleCreateTask} className="w-full" disabled={!newTask.title.trim()}>
              Utwórz zadanie cykliczne
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
