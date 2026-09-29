"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Trash2,
  Repeat,
  Clock,
  Calendar,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { DescriptionField } from "@/components/editor/lazy"
import { htmlToPlainText, normalizeRichText } from "@/lib/rich-text"
import {
  RecurrencePicker,
  defaultRecurrenceValue,
  type RecurrenceValue,
} from "@/components/tasks/recurrence-picker"
import {
  FREQUENCY_GROUPS,
  describeTaskRecurrence,
  parseTaskRecurrence,
  serializeTaskRecurrence,
} from "@/lib/task-recurrence"

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
  // From the API: the day the rule counts from and the next days it lands on
  startDate?: string
  nextDates?: string[]
}

const taskDay = (task: RecurringTask) => (task.scheduledDate ? task.scheduledDate.slice(0, 10) : undefined)
const parseTaskRule = (task: RecurringTask) => parseTaskRecurrence(task.recurrenceRule, taskDay(task))

// Rule for the API; the server sets the start (DTSTART) itself
const ruleFromValue = (value: RecurrenceValue) => serializeTaskRecurrence({ ...value.recurrence, anchor: null })

const fromDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}

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
    scheduledTime: "",
    plannedMinutes: "",
    priority: 0,
    categoryId: "",
  })

  // Edit state
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    scheduledTime: "",
    plannedMinutes: "",
    priority: 0,
    categoryId: "",
  })

  // When the task repeats (new / edited task)
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceValue>(() => defaultRecurrenceValue())
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceValue>(() => defaultRecurrenceValue())

  // Expanded task detail
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

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
    if (!newTask.title.trim()) return

    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTask,
          description: normalizeRichText(newTask.description),
          recurrenceRule: ruleFromValue(newRecurrence),
          startDate: newRecurrence.start,
          workspace,
          plannedMinutes: newTask.plannedMinutes ? parseInt(newTask.plannedMinutes) : null,
        }),
      })
      if (res.ok) {
        fetchTasks()
        setNewTask({
          title: "",
          description: "",
          scheduledTime: "",
          plannedMinutes: "",
          priority: 0,
          categoryId: "",
        })
        setNewRecurrence(defaultRecurrenceValue())
        setIsDialogOpen(false)
        toast.success("Zadanie cykliczne utworzone")
      } else {
        toast.error("Nie udało się utworzyć zadania")
      }
    } catch (error) {
      console.error("Error creating recurring task:", error)
      toast.error("Błąd podczas tworzenia zadania")
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie cykliczne?")) return
    try {
      const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchTasks()
        toast.success("Zadanie cykliczne usunięte")
      } else {
        toast.error("Nie udało się usunąć zadania")
      }
    } catch (error) {
      console.error("Error deleting recurring task:", error)
      toast.error("Błąd podczas usuwania zadania")
    }
  }

  const handleToggleActive = async (task: RecurringTask) => {
    try {
      const res = await fetch(`/api/recurring/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRecurring: true }),
      })
      if (res.ok) {
        fetchTasks()
      } else {
        toast.error("Nie udało się zaktualizować zadania")
      }
    } catch (error) {
      console.error("Error toggling task:", error)
      toast.error("Błąd podczas aktualizacji")
    }
  }

  // Edit handlers
  const handleStartEdit = (task: RecurringTask) => {
    setEditingTask(task)
    const recurrence = parseTaskRule(task)
    const start = task.startDate ?? recurrence?.anchor ?? taskDay(task)
    setEditRecurrence(recurrence && start ? { recurrence, start } : defaultRecurrenceValue())
    setEditForm({
      title: task.title,
      description: task.description || "",
      scheduledTime: task.scheduledTime || "",
      plannedMinutes: task.plannedMinutes?.toString() || "",
      priority: task.priority,
      categoryId: task.category?.id || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingTask || !editForm.title.trim()) return

    try {
      const res = await fetch(`/api/recurring/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: normalizeRichText(editForm.description),
          recurrenceRule: ruleFromValue(editRecurrence),
          startDate: editRecurrence.start,
          scheduledTime: editForm.scheduledTime || null,
          plannedMinutes: editForm.plannedMinutes ? parseInt(editForm.plannedMinutes) : null,
          priority: editForm.priority,
          categoryId: editForm.categoryId || null,
        }),
      })
      if (res.ok) {
        fetchTasks()
        setEditingTask(null)
        toast.success("Zadanie zaktualizowane")
      } else {
        toast.error("Nie udało się zaktualizować zadania")
      }
    } catch (error) {
      console.error("Error updating task:", error)
      toast.error("Błąd podczas aktualizacji zadania")
    }
  }

  const getPriorityOption = (priority: number) => {
    return PRIORITY_OPTIONS.find(o => o.value === priority) || PRIORITY_OPTIONS[0]
  }

  // Group tasks by how often they repeat
  const groupedTasks = FREQUENCY_GROUPS.map((group) => ({
    label: group.label,
    tasks: tasks.filter((task) => {
      const freq = parseTaskRule(task)?.freq
      return !!freq && group.freq.includes(freq)
    }),
  }))
  const unknownRuleTasks = tasks.filter((task) => !parseTaskRule(task))
  if (unknownRuleTasks.length > 0) groupedTasks.push({ label: "Inne", tasks: unknownRuleTasks })
  const countFreq = (...freqs: string[]) =>
    tasks.filter((task) => freqs.includes(parseTaskRule(task)?.freq ?? "")).length

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
          <h1 className="text-2xl md:text-3xl font-bold">Zadania Cykliczne</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Zarządzaj zadaniami, które powtarzają się regularnie
          </p>
        </div>

        <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
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
            <div className="text-2xl font-bold">{countFreq("DAILY", "WEEKDAYS")}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Tygodniowe</div>
            <div className="text-2xl font-bold">{countFreq("WEEKLY")}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Miesięczne</div>
            <div className="text-2xl font-bold">{countFreq("MONTHLY")}</div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks by Category */}
      {groupedTasks.filter((group) => group.tasks.length > 0).map(({ label, tasks: ruleTasks }) => (
        <Card key={label}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              {label}
              <Badge variant="secondary">{ruleTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_150px_100px_100px_80px] gap-2 p-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
                <div>Zadanie</div>
                <div>Kategoria</div>
                <div className="text-center">Czas</div>
                <div className="text-center">Priorytet</div>
                <div>Akcje</div>
              </div>

              {/* Task Rows */}
              {ruleTasks.map((task) => {
                const priorityOption = getPriorityOption(task.priority)
                const isExpanded = expandedTaskId === task.id
                const nextDates = task.nextDates ?? []
                const recurrence = parseTaskRule(task)

                return (
                  <div key={task.id} className="border-b last:border-b-0">
                    <div
                      className="grid grid-cols-[1fr_150px_100px_100px_80px] gap-2 p-3 items-center hover:bg-muted/20"
                    >
                      {/* Task Info */}
                      <div>
                        <button
                          className="flex items-center gap-2 text-left w-full"
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <div>
                            <div className="font-medium">{task.title}</div>
                            {recurrence && (
                              <div className="text-xs font-medium text-primary flex items-center gap-1 mt-0.5">
                                <Repeat className="h-3 w-3" />
                                {describeTaskRecurrence(recurrence)}
                              </div>
                            )}
                            {task.description && (
                              <div className="text-sm text-muted-foreground truncate">
                                {htmlToPlainText(task.description)}
                              </div>
                            )}
                            {task.scheduledTime && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {task.scheduledTime}
                              </div>
                            )}
                          </div>
                        </button>
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

                      {/* Actions */}
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleStartEdit(task)}
                          title="Edytuj"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDeleteTask(task.id)}
                          title="Usuń"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded dates section */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 bg-muted/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Następne wystąpienia:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {nextDates.map((date) => (
                            <Badge key={date} variant="secondary" className="text-xs">
                              {format(fromDay(date), "EEEE, d MMM", { locale: pl })}
                            </Badge>
                          ))}
                          {nextDates.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              {recurrence?.freq === "SPRINT_END" || recurrence?.freq === "PERIOD_END"
                                ? "Brak zaplanowanych sprintów / okresów w module Cele"
                                : "Brak kolejnych terminów"}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
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
        <DialogContent className="max-w-xl">
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
              <DescriptionField
                value={newTask.description}
                onChange={(html) => setNewTask((prev) => ({ ...prev, description: html }))}
                placeholder="Szczegóły zadania, plan, checklista..."
                title={newTask.title || "Zadanie cykliczne"}
                subtitle="Opis zadania cyklicznego · kopiowany do każdego powtórzenia"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kiedy się powtarza</Label>
              <RecurrencePicker value={newRecurrence} onChange={setNewRecurrence} allowDeadlines={workspace === "WORK"} />
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
                  value={newTask.categoryId || "none"}
                  onValueChange={(v) => setNewTask({ ...newTask, categoryId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak</SelectItem>
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

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edytuj zadanie cykliczne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nazwa zadania</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="np. Codzienny raport"
              />
            </div>

            <div>
              <Label>Opis (opcjonalnie)</Label>
              <DescriptionField
                value={editForm.description}
                onChange={(html) => setEditForm((prev) => ({ ...prev, description: html }))}
                placeholder="Szczegóły zadania, plan, checklista..."
                title={editForm.title || "Zadanie cykliczne"}
                subtitle="Opis zadania cyklicznego · kopiowany do każdego powtórzenia"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kiedy się powtarza</Label>
              <RecurrencePicker value={editRecurrence} onChange={setEditRecurrence} allowDeadlines={workspace === "WORK"} />
              {editingTask && taskDay(editingTask) && (taskDay(editingTask) as string) < format(new Date(), "yyyy-MM-dd") && (
                <p className="text-xs text-muted-foreground">
                  Już wykonane powtórzenia zostają na swoich dniach — zmiana dotyczy kolejnych.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Godzina (opcjonalnie)</Label>
                <Input
                  type="time"
                  value={editForm.scheduledTime}
                  onChange={(e) => setEditForm({ ...editForm, scheduledTime: e.target.value })}
                />
              </div>
              <div>
                <Label>Czas trwania (min)</Label>
                <Input
                  type="number"
                  value={editForm.plannedMinutes}
                  onChange={(e) => setEditForm({ ...editForm, plannedMinutes: e.target.value })}
                  placeholder="np. 30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategoria</Label>
                <Select
                  value={editForm.categoryId || "none"}
                  onValueChange={(v) => setEditForm({ ...editForm, categoryId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak</SelectItem>
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
                  value={editForm.priority.toString()}
                  onValueChange={(v) => setEditForm({ ...editForm, priority: parseInt(v) })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              Anuluj
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editForm.title.trim()}>
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
