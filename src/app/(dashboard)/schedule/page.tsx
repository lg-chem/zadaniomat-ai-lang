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
import { useTasks, type Task, type TaskStatus } from "@/hooks/use-tasks"
import { useCategories, type Category } from "@/hooks/use-categories"
import { useSprints } from "@/hooks/use-sprints"

type RecurrenceRule = "DAILY" | "WEEKLY" | "WEEKDAYS" | "MONTHLY" | null

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
  const dateString = format(selectedDate, "yyyy-MM-dd")

  // Use SWR hooks for data fetching with cache
  const { tasks, isLoading: tasksLoading, mutate: mutateTasks } = useTasks({ date: dateString })
  const { categories, isLoading: categoriesLoading } = useCategories()
  const { activeSprint } = useSprints()

  const isLoading = tasksLoading || categoriesLoading

  // Inline add task state
  const [newTask, setNewTask] = useState({
    title: "",
    categoryId: "",
    plannedMinutes: "25",
    recurrenceRule: "none",
  })
  const [isAddingTask, setIsAddingTask] = useState(false)
  const newTaskRef = useRef<HTMLInputElement>(null)

  // Template inputs for strategic categories - keyed by categoryId
  const [templateInputs, setTemplateInputs] = useState<Record<string, {
    title: string
    plannedMinutes: string
    recurrenceRule: string
  }>>({})

  // Inline edit task state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  // Generate recurring tasks on date change
  useEffect(() => {
    const generateRecurringTasks = async () => {
      try {
        await fetch("/api/tasks/generate-recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateString, workspace }),
        })
        // Refresh tasks after generating recurring ones
        mutateTasks()
      } catch (error) {
        console.error("Error generating recurring tasks:", error)
      }
    }
    generateRecurringTasks()
  }, [dateString, workspace, mutateTasks])

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
        mutateTasks()
        setNewTask({ title: "", categoryId: "", plannedMinutes: "25", recurrenceRule: "none" })
        setIsAddingTask(false)
      }
    } catch (error) {
      console.error("Error creating task:", error)
    }
  }

  // Handle template input change
  const handleTemplateInputChange = (categoryId: string, field: string, value: string) => {
    setTemplateInputs((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId] || { title: "", plannedMinutes: "25", recurrenceRule: "none" },
        [field]: value,
      },
    }))
  }

  // Create task from template
  const handleCreateFromTemplate = async (categoryId: string) => {
    const input = templateInputs[categoryId]
    if (!input?.title?.trim()) return

    const isRecurring = input.recurrenceRule !== "none"

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          categoryId,
          plannedMinutes: parseInt(input.plannedMinutes) || 25,
          scheduledDate: dateString,
          orderInDay: tasks.length,
          workspaceType: workspace,
          status: "NEW",
          isRecurring,
          recurrenceRule: isRecurring ? input.recurrenceRule : null,
        }),
      })
      if (res.ok) {
        mutateTasks()
        // Clear input
        setTemplateInputs((prev) => ({
          ...prev,
          [categoryId]: { title: "", plannedMinutes: "25", recurrenceRule: "none" },
        }))
      }
    } catch (error) {
      console.error("Error creating task from template:", error)
    }
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
      mutateTasks()
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
      mutateTasks()
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
      mutateTasks()
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
      mutateTasks()
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
      mutateTasks()
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie?")) return
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      mutateTasks()
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
      mutateTasks()
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

  // Get tasks by category for templates
  const getTasksForCategory = (categoryId: string) => {
    return tasks.filter((t) => t.categoryId === categoryId)
  }

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
          {/* Sprint info in header */}
          {workspace === "WORK" && activeSprint && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-primary/5">
                <Target className="h-3 w-3 mr-1" />
                Sprint: {activeSprint.name}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(activeSprint.startDate), "d MMM", { locale: pl })} -{" "}
                {format(new Date(activeSprint.endDate), "d MMM yyyy", { locale: pl })}
              </span>
            </div>
          )}
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
        <CardContent className="flex items-center gap-8 py-4">
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
        </CardContent>
      </Card>

      {/* Strategic Category Templates */}
      {strategicCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Kategorie strategiczne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {strategicCategories.map((category) => {
                const categoryTasks = getTasksForCategory(category.id)
                const input = templateInputs[category.id] || { title: "", plannedMinutes: "25", recurrenceRule: "none" }

                return (
                  <div key={category.id} className="border rounded-lg p-3 bg-muted/20">
                    {/* Category header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium text-sm">{category.name}</span>
                      {categoryTasks.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{categoryTasks.length}</Badge>
                      )}
                    </div>

                    {/* Existing tasks for this category */}
                    {categoryTasks.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {categoryTasks.map((task) => (
                          <div
                            key={task.id}
                            className={`text-xs p-1.5 rounded flex items-center justify-between ${
                              task.status === "COMPLETED"
                                ? "bg-green-50 text-green-700 line-through"
                                : "bg-background"
                            }`}
                          >
                            <span className="truncate">{task.title}</span>
                            <Badge className={`${STATUS_COLORS[task.status]} text-[9px] ml-1`}>
                              {task.plannedMinutes}m
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Input row */}
                    <div className="flex gap-1">
                      <Input
                        placeholder="Nazwa zadania..."
                        value={input.title}
                        onChange={(e) => handleTemplateInputChange(category.id, "title", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCreateFromTemplate(category.id)
                          }
                        }}
                        className="h-7 text-xs flex-1"
                      />
                      <Input
                        type="number"
                        min="5"
                        step="5"
                        placeholder="min"
                        value={input.plannedMinutes}
                        onChange={(e) => handleTemplateInputChange(category.id, "plannedMinutes", e.target.value)}
                        className="h-7 text-xs w-14 text-center"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2"
                        onClick={() => handleCreateFromTemplate(category.id)}
                        disabled={!input.title.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sprint Goals - WORK only, grouped by category */}
      {workspace === "WORK" && activeSprint && activeSprint.goals.length > 0 && (() => {
        // Group goals by category
        const goalsByCategory = activeSprint.goals.reduce((acc, goal) => {
          const categoryName = goal.category?.name || "Bez kategorii"
          const categoryColor = goal.category?.color || "#6b7280"
          const key = goal.category?.id || "none"
          if (!acc[key]) {
            acc[key] = { name: categoryName, color: categoryColor, goals: [] }
          }
          acc[key].goals.push(goal)
          return acc
        }, {} as Record<string, { name: string; color: string; goals: typeof activeSprint.goals }>)

        return (
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
            <CardContent className="space-y-4">
              {Object.entries(goalsByCategory).map(([categoryId, { name, color, goals }]) => (
                <div key={categoryId}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">({goals.length})</span>
                  </div>
                  <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 pl-5">
                    {goals.map((goal) => {
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
                            <span className={`font-medium text-sm ${goal.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                              {goal.title}
                            </span>
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
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })()}

      {/* Task Table - Spreadsheet style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Zadania na dziś</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile View - Cards */}
          <div className="space-y-2 md:hidden">
            {tasks.map((task) => (
              <Card key={task.id} className={task.status === "COMPLETED" ? "opacity-60" : ""}>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {/* Title and Status */}
                    <div className="flex items-start gap-2">
                      {editingTaskId === task.id ? (
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, () => handleUpdateTaskTitle(task.id))}
                          onBlur={() => handleUpdateTaskTitle(task.id)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      ) : (
                        <div
                          className="flex-1 flex items-center gap-2"
                          onClick={() => handleStartEdit(task)}
                        >
                          {task.isRecurring && (
                            <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />
                          )}
                          <span className={`text-sm font-medium ${task.status === "COMPLETED" ? "line-through" : ""}`}>
                            {task.title}
                          </span>
                        </div>
                      )}
                      <Badge className={`${STATUS_COLORS[task.status]} text-[10px]`}>
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </div>

                    {/* Category and Time */}
                    <div className="flex items-center gap-2 text-xs">
                      {task.category && (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: task.category.color }}
                          />
                          <span>{task.category.name}</span>
                        </div>
                      )}
                      {task.plannedMinutes && (
                        <span className="text-muted-foreground">• {task.plannedMinutes} min</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1">
                      <Button
                        size="sm"
                        variant={task.status === "COMPLETED" ? "outline" : "default"}
                        onClick={() =>
                          handleUpdateTaskStatus(
                            task.id,
                            task.status === "COMPLETED" ? "NEW" : "COMPLETED"
                          )
                        }
                        className="h-7 text-xs"
                      >
                        {task.status === "COMPLETED" ? "Cofnij" : "Zakończ"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTask(task.id)}
                        className="h-7 text-xs"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Mobile Add Task Button */}
            {!isAddingTask && (
              <Button
                onClick={handleAddRowClick}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj zadanie
              </Button>
            )}
          </div>

          {/* Desktop View - Table */}
          <div className="border rounded-lg overflow-hidden hidden md:block">
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
