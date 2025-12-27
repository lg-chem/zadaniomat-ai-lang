"use client"

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react"
import { format, addDays, subDays } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Check,
  X,
  ArrowRight,
  Trash2,
  Sparkles,
  Repeat,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useTimerStore, formatMinutes } from "@/stores/timer-store"

type TaskStatus = "NEW" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "TO_TRANSFER"
type RecurrenceRule = "DAILY" | "WEEKLY" | "WEEKDAYS" | "MONTHLY" | null

interface Category {
  id: string
  name: string
  color: string
  isStrategic: boolean
}

interface Task {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  plannedMinutes?: number | null
  actualMinutes: number
  scheduledDate?: string | null
  orderInDay: number
  category?: Category | null
  categoryId?: string | null
  goalId?: string | null
  goal?: { id: string; title: string } | null
  isRecurring?: boolean
  recurrenceRule?: RecurrenceRule
}

interface SprintGoal {
  id: string
  title: string
  targetValue?: number | null
  currentValue: number
  unit?: string | null
  isCompleted: boolean
  category?: { id: string; name: string; color: string } | null
}

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  goals: SprintGoal[]
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  NEW: "Nowe",
  IN_PROGRESS: "W trakcie",
  COMPLETED: "Zakończone",
  CANCELLED: "Anulowane",
  TO_TRANSFER: "Do przeniesienia",
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  NEW: "bg-slate-100 text-slate-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  TO_TRANSFER: "bg-orange-100 text-orange-800",
}

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Brak" },
  { value: "DAILY", label: "Codziennie" },
  { value: "WEEKDAYS", label: "Dni robocze" },
  { value: "WEEKLY", label: "Co tydzień" },
  { value: "MONTHLY", label: "Co miesiąc" },
]

export default function SchedulePage() {
  const { workspace } = useWorkspaceStore()
  const timerStore = useTimerStore()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Inline add task state
  const [newTask, setNewTask] = useState({
    title: "",
    categoryId: "",
    plannedMinutes: "25",
    recurrenceRule: "none",
  })
  const [isAddingTask, setIsAddingTask] = useState(false)
  const newTaskRef = useRef<HTMLInputElement>(null)

  // Inline edit task state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  const dateString = format(selectedDate, "yyyy-MM-dd")

  // Generate recurring tasks for the selected date
  const generateRecurringTasks = useCallback(async () => {
    try {
      await fetch("/api/tasks/generate-recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateString, workspace }),
      })
    } catch (error) {
      console.error("Error generating recurring tasks:", error)
    }
  }, [dateString, workspace])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tasks?workspace=${workspace}&date=${dateString}`
      )
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (error) {
      console.error("Error fetching tasks:", error)
    } finally {
      setIsLoading(false)
    }
  }, [workspace, dateString])

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

  const fetchActiveSprint = useCallback(async () => {
    if (workspace !== "WORK") {
      setActiveSprint(null)
      return
    }
    try {
      const res = await fetch("/api/sprints/active")
      if (res.ok) {
        const data = await res.json()
        setActiveSprint(data)
      }
    } catch (error) {
      console.error("Error fetching active sprint:", error)
    }
  }, [workspace])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await generateRecurringTasks()
      await fetchTasks()
      await fetchCategories()
      await fetchActiveSprint()
    }
    loadData()
  }, [generateRecurringTasks, fetchTasks, fetchCategories, fetchActiveSprint])

  const handlePrevDay = () => setSelectedDate((d) => subDays(d, 1))
  const handleNextDay = () => setSelectedDate((d) => addDays(d, 1))
  const handleToday = () => setSelectedDate(new Date())

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return

    const isRecurring = newTask.recurrenceRule !== "none"

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          categoryId: newTask.categoryId || undefined,
          plannedMinutes: parseInt(newTask.plannedMinutes) || 25,
          scheduledDate: dateString,
          orderInDay: tasks.length,
          workspaceType: workspace,
          status: "NEW",
          isRecurring,
          recurrenceRule: isRecurring ? newTask.recurrenceRule : null,
        }),
      })
      if (res.ok) {
        fetchTasks()
        setNewTask({ title: "", categoryId: "", plannedMinutes: "25", recurrenceRule: "none" })
        setIsAddingTask(false)
      }
    } catch (error) {
      console.error("Error creating task:", error)
    }
  }

  const handleGenerateTemplates = async () => {
    const strategicCategories = categories.filter((c) => c.isStrategic)

    for (const category of strategicCategories) {
      const existingTask = tasks.find((t) => t.categoryId === category.id)
      if (!existingTask) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${category.name} - `,
            categoryId: category.id,
            plannedMinutes: 25,
            scheduledDate: dateString,
            orderInDay: tasks.length,
            workspaceType: workspace,
            status: "NEW",
          }),
        })
      }
    }

    fetchTasks()
  }

  const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      const updateData: Record<string, unknown> = { status }

      if (status === "COMPLETED") {
        updateData.completedAt = new Date().toISOString()
      }

      if (status === "IN_PROGRESS" && !timerStore.isRunning) {
        const task = tasks.find((t) => t.id === taskId)
        if (task) {
          timerStore.startTimer(taskId, task.title, task.plannedMinutes || undefined)
        }
      }

      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })
      fetchTasks()
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleUpdateTaskTitle = async (taskId: string) => {
    if (!editingTitle.trim()) {
      setEditingTaskId(null)
      return
    }

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle }),
      })
      fetchTasks()
      setEditingTaskId(null)
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleUpdateTaskCategory = async (taskId: string, categoryId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: categoryId || null }),
      })
      fetchTasks()
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleUpdateTaskTime = async (taskId: string, minutes: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedMinutes: parseInt(minutes) || 25 }),
      })
      fetchTasks()
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleUpdateTaskRecurrence = async (taskId: string, recurrence: string) => {
    const isRecurring = recurrence !== "none"
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isRecurring,
          recurrenceRule: isRecurring ? recurrence : null,
        }),
      })
      fetchTasks()
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie?")) return
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      fetchTasks()
    } catch (error) {
      console.error("Error deleting task:", error)
    }
  }

  const handleTransferTask = async (taskId: string) => {
    const nextDay = format(addDays(selectedDate, 1), "yyyy-MM-dd")
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: nextDay,
          status: "NEW",
        }),
      })
      fetchTasks()
    } catch (error) {
      console.error("Error transferring task:", error)
    }
  }

  const handleStartTimer = (task: Task) => {
    timerStore.startTimer(task.id, task.title, task.plannedMinutes || undefined)
    handleUpdateTaskStatus(task.id, "IN_PROGRESS")
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
    if (e.key === "Escape") {
      setIsAddingTask(false)
      setEditingTaskId(null)
      setNewTask({ title: "", categoryId: "", plannedMinutes: "25", recurrenceRule: "none" })
    }
  }

  const handleAddRowClick = () => {
    setIsAddingTask(true)
    setTimeout(() => newTaskRef.current?.focus(), 0)
  }

  const handleStartEdit = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingTitle(task.title)
  }

  const strategicCategories = categories.filter((c) => c.isStrategic)

  // Calculate stats
  const totalPlanned = tasks.reduce((sum, t) => sum + (t.plannedMinutes || 0), 0)
  const totalActual = tasks.reduce((sum, t) => sum + t.actualMinutes, 0)
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length

  // Count how many strategic categories don't have tasks yet
  const missingStrategicCount = strategicCategories.filter(
    (c) => !tasks.find((t) => t.categoryId === c.id)
  ).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with date navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Harmonogram dnia</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Planuj i śledź zadania na każdy dzień
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday}>
            <Calendar className="h-4 w-4 mr-2" />
            Dziś
          </Button>
          <div className="px-4 py-2 font-medium min-w-[180px] text-center">
            {format(selectedDate, "EEEE, d MMMM yyyy", { locale: pl })}
          </div>
          <Button variant="outline" size="icon" onClick={handleNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-8">
            <div>
              <div className="text-sm text-muted-foreground">Zadania</div>
              <div className="text-2xl font-bold">
                {completedTasks}/{tasks.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Planowany czas</div>
              <div className="text-2xl font-bold">{formatMinutes(totalPlanned)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Rzeczywisty czas</div>
              <div className="text-2xl font-bold">{formatMinutes(totalActual)}</div>
            </div>
          </div>
          {missingStrategicCount > 0 && (
            <Button variant="outline" onClick={handleGenerateTemplates}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generuj szablony ({missingStrategicCount})
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Sprint Goals - WORK only */}
      {workspace === "WORK" && activeSprint && activeSprint.goals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Cele sprintu: {activeSprint.name}
              </CardTitle>
              <Badge variant="secondary">
                {format(new Date(activeSprint.startDate), "d MMM", { locale: pl })} -{" "}
                {format(new Date(activeSprint.endDate), "d MMM", { locale: pl })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              {activeSprint.goals.map((goal) => {
                const progress = goal.targetValue
                  ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
                  : 0

                return (
                  <div
                    key={goal.id}
                    className={`p-3 rounded-lg border ${
                      goal.isCompleted ? "bg-green-50 border-green-200" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-col gap-1">
                        {goal.category && (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: goal.category.color }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {goal.category.name}
                            </span>
                          </div>
                        )}
                        <span className={`font-medium text-sm ${goal.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {goal.title}
                        </span>
                      </div>
                      {goal.isCompleted && (
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    {goal.targetValue && (
                      <>
                        <Progress value={progress} className="h-1.5 mb-1" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Table - Spreadsheet style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Zadania na dziś</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[160px_1fr_70px_100px_180px] gap-2 p-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
              <div>Kategoria</div>
              <div>Nazwa zadania</div>
              <div>Czas</div>
              <div className="flex items-center gap-1">
                <Repeat className="h-3 w-3" />
                Powtarzaj
              </div>
              <div>Akcje</div>
            </div>

            {/* Existing Tasks */}
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`grid grid-cols-[160px_1fr_70px_100px_180px] gap-2 p-3 border-b last:border-b-0 items-center transition-colors ${
                  task.status === "COMPLETED"
                    ? "bg-muted/30 opacity-60"
                    : task.status === "IN_PROGRESS"
                    ? "bg-primary/5 border-l-2 border-l-primary"
                    : "hover:bg-muted/20"
                }`}
              >
                {/* Category Select */}
                <div>
                  <Select
                    value={task.categoryId || "none"}
                    onValueChange={(value) =>
                      handleUpdateTaskCategory(task.id, value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        {task.category ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: task.category.color }}
                            />
                            <span className="truncate">{task.category.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Brak</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Brak kategorii</span>
                      </SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                            {category.isStrategic && (
                              <Badge variant="secondary" className="text-[10px] px-1">
                                S
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div>
                  {editingTaskId === task.id ? (
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleUpdateTaskTitle(task.id))}
                      onBlur={() => handleUpdateTaskTitle(task.id)}
                      className="h-8"
                      autoFocus
                    />
                  ) : (
                    <div
                      className={`cursor-text px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-2 ${
                        task.status === "COMPLETED" ? "line-through" : ""
                      }`}
                      onClick={() => handleStartEdit(task)}
                    >
                      {task.isRecurring && (
                        <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="truncate">{task.title}</span>
                      <Badge className={`${STATUS_COLORS[task.status]} text-[10px] flex-shrink-0`}>
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Time */}
                <div>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={task.plannedMinutes || 25}
                    onChange={(e) => handleUpdateTaskTime(task.id, e.target.value)}
                    className="h-8 text-center text-xs"
                  />
                </div>

                {/* Recurrence */}
                <div>
                  <Select
                    value={task.recurrenceRule || "none"}
                    onValueChange={(value) => handleUpdateTaskRecurrence(task.id, value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
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
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
                    <>
                      <Button
                        size="icon"
                        variant={timerStore.taskId === task.id ? "default" : "ghost"}
                        className="h-7 w-7"
                        onClick={() => handleStartTimer(task)}
                        disabled={timerStore.taskId === task.id}
                        title="Start timer"
                      >
                        {timerStore.taskId === task.id ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleUpdateTaskStatus(task.id, "COMPLETED")}
                        title="Zakończ"
                      >
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleTransferTask(task.id)}
                        title="Przenieś na jutro"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleUpdateTaskStatus(task.id, "CANCELLED")}
                        title="Anuluj"
                      >
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDeleteTask(task.id)}
                    title="Usuń"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add New Task Row */}
            {isAddingTask ? (
              <div className="grid grid-cols-[160px_1fr_70px_100px_180px] gap-2 p-3 items-center bg-primary/5">
                {/* Category Select */}
                <div>
                  <Select
                    value={newTask.categoryId || "none"}
                    onValueChange={(value) =>
                      setNewTask({ ...newTask, categoryId: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Kategoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Brak kategorii</span>
                      </SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title Input */}
                <div>
                  <Input
                    ref={newTaskRef}
                    placeholder="Wpisz nazwę zadania..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, handleCreateTask)}
                    className="h-8"
                  />
                </div>

                {/* Time Input */}
                <div>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={newTask.plannedMinutes}
                    onChange={(e) => setNewTask({ ...newTask, plannedMinutes: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, handleCreateTask)}
                    className="h-8 text-center text-xs"
                  />
                </div>

                {/* Recurrence Select */}
                <div>
                  <Select
                    value={newTask.recurrenceRule}
                    onValueChange={(value) => setNewTask({ ...newTask, recurrenceRule: value })}
                  >
                    <SelectTrigger className="h-8 text-xs">
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
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCreateTask}
                    disabled={!newTask.title.trim()}
                  >
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setIsAddingTask(false)
                      setNewTask({ title: "", categoryId: "", plannedMinutes: "25", recurrenceRule: "none" })
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleAddRowClick}
                className="w-full p-3 text-left text-muted-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Dodaj zadanie...
              </button>
            )}
          </div>

          {/* Empty state */}
          {tasks.length === 0 && !isAddingTask && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak zadań na ten dzień</p>
              <p className="text-sm">Kliknij "Dodaj zadanie" lub wygeneruj szablony</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
