"use client"

import { useEffect, useState, useCallback } from "react"
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
  Clock,
  Trash2,
  GripVertical,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useTimerStore, formatTime, formatMinutes } from "@/stores/timer-store"

type TaskStatus = "NEW" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "TO_TRANSFER"

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

export default function SchedulePage() {
  const { workspace } = useWorkspaceStore()
  const timerStore = useTimerStore()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Dialog states
  const [showAddTask, setShowAddTask] = useState(false)
  const [showGenerateTemplates, setShowGenerateTemplates] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // New task form
  const [newTask, setNewTask] = useState({
    title: "",
    categoryId: "",
    goalId: "",
    plannedMinutes: "25",
  })

  const dateString = format(selectedDate, "yyyy-MM-dd")

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

  useEffect(() => {
    setIsLoading(true)
    fetchTasks()
    fetchCategories()
  }, [fetchTasks, fetchCategories])

  const handlePrevDay = () => setSelectedDate((d) => subDays(d, 1))
  const handleNextDay = () => setSelectedDate((d) => addDays(d, 1))
  const handleToday = () => setSelectedDate(new Date())

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          categoryId: newTask.categoryId || undefined,
          goalId: newTask.goalId || undefined,
          plannedMinutes: parseInt(newTask.plannedMinutes) || 25,
          scheduledDate: dateString,
          orderInDay: tasks.length,
          workspaceType: workspace,
          status: "NEW",
        }),
      })
      if (res.ok) {
        fetchTasks()
        setShowAddTask(false)
        setNewTask({ title: "", categoryId: "", goalId: "", plannedMinutes: "25" })
      }
    } catch (error) {
      console.error("Error creating task:", error)
    }
  }

  const handleGenerateTemplates = async () => {
    const strategicCategories = categories.filter((c) => c.isStrategic)

    for (const category of strategicCategories) {
      // Sprawdź czy już jest zadanie z tej kategorii na ten dzień
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
    setShowGenerateTemplates(false)
  }

  const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      const updateData: Record<string, unknown> = { status }

      if (status === "COMPLETED") {
        updateData.completedAt = new Date().toISOString()
      }

      if (status === "IN_PROGRESS" && !timerStore.isRunning) {
        // Start timer for this task
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
    // Przenieś zadanie na następny dzień
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

  const strategicCategories = categories.filter((c) => c.isStrategic)

  // Group tasks by category
  const tasksByCategory = tasks.reduce((acc, task) => {
    const categoryId = task.categoryId || "uncategorized"
    if (!acc[categoryId]) acc[categoryId] = []
    acc[categoryId].push(task)
    return acc
  }, {} as Record<string, Task[]>)

  // Calculate stats
  const totalPlanned = tasks.reduce((sum, t) => sum + (t.plannedMinutes || 0), 0)
  const totalActual = tasks.reduce((sum, t) => sum + t.actualMinutes, 0)
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with date navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Harmonogram dnia</h1>
          <p className="text-muted-foreground">
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowGenerateTemplates(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generuj szablony
            </Button>
            <Button onClick={() => setShowAddTask(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj zadanie
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks grouped by category */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak zadań na ten dzień</h3>
            <p className="text-muted-foreground text-center mb-4">
              Dodaj zadania lub wygeneruj szablony z kategorii strategicznych
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowGenerateTemplates(true)}>
                Generuj szablony
              </Button>
              <Button onClick={() => setShowAddTask(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj zadanie
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Strategic categories first */}
          {strategicCategories.map((category) => {
            const categoryTasks = tasksByCategory[category.id] || []
            if (categoryTasks.length === 0) return null

            return (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                    <Badge variant="secondary" className="ml-2">
                      {categoryTasks.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categoryTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isTimerRunning={timerStore.taskId === task.id}
                      onStartTimer={() => handleStartTimer(task)}
                      onStatusChange={(status) => handleUpdateTaskStatus(task.id, status)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onTransfer={() => handleTransferTask(task.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            )
          })}

          {/* Uncategorized tasks */}
          {tasksByCategory["uncategorized"]?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-4 w-4 rounded-full bg-gray-400" />
                  Bez kategorii
                  <Badge variant="secondary" className="ml-2">
                    {tasksByCategory["uncategorized"].length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasksByCategory["uncategorized"].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isTimerRunning={timerStore.taskId === task.id}
                    onStartTimer={() => handleStartTimer(task)}
                    onStatusChange={(status) => handleUpdateTaskStatus(task.id, status)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onTransfer={() => handleTransferTask(task.id)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Other categories */}
          {categories
            .filter((c) => !c.isStrategic && tasksByCategory[c.id]?.length > 0)
            .map((category) => (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                    <Badge variant="secondary" className="ml-2">
                      {tasksByCategory[category.id].length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasksByCategory[category.id].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isTimerRunning={timerStore.taskId === task.id}
                      onStartTimer={() => handleStartTimer(task)}
                      onStatusChange={(status) => handleUpdateTaskStatus(task.id, status)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onTransfer={() => handleTransferTask(task.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Add Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowe zadanie</DialogTitle>
            <DialogDescription>
              Dodaj zadanie na {format(selectedDate, "d MMMM yyyy", { locale: pl })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Kategoria</Label>
                <Select
                  value={newTask.categoryId}
                  onValueChange={(value) =>
                    setNewTask({ ...newTask, categoryId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                          {category.isStrategic && (
                            <Badge variant="secondary" className="text-xs">
                              strategiczna
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskTitle">Nazwa zadania (TODO)</Label>
                <Input
                  id="taskTitle"
                  placeholder="Co chcesz zrobić?"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plannedTime">Planowany czas (minuty)</Label>
                <Input
                  id="plannedTime"
                  type="number"
                  min="5"
                  step="5"
                  placeholder="25"
                  value={newTask.plannedMinutes}
                  onChange={(e) =>
                    setNewTask({ ...newTask, plannedMinutes: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddTask(false)}
              >
                Anuluj
              </Button>
              <Button type="submit">Dodaj zadanie</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate Templates Dialog */}
      <Dialog open={showGenerateTemplates} onOpenChange={setShowGenerateTemplates}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generuj szablony zadań</DialogTitle>
            <DialogDescription>
              Zostanie utworzone jedno zadanie dla każdej kategorii strategicznej,
              której jeszcze nie ma na ten dzień.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Kategorie strategiczne ({strategicCategories.length}):
            </p>
            <div className="space-y-2">
              {strategicCategories.map((category) => {
                const existingTask = tasks.find(
                  (t) => t.categoryId === category.id
                )
                return (
                  <div
                    key={category.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span>{category.name}</span>
                    {existingTask ? (
                      <Badge variant="secondary" className="ml-auto">
                        już dodane
                      </Badge>
                    ) : (
                      <Badge className="ml-auto">do dodania</Badge>
                    )}
                  </div>
                )
              })}
            </div>
            {strategicCategories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Brak kategorii strategicznych. Dodaj je w Ustawieniach.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGenerateTemplates(false)}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleGenerateTemplates}
              disabled={strategicCategories.length === 0}
            >
              Generuj szablony
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Task Card Component
function TaskCard({
  task,
  isTimerRunning,
  onStartTimer,
  onStatusChange,
  onDelete,
  onTransfer,
}: {
  task: Task
  isTimerRunning: boolean
  onStartTimer: () => void
  onStatusChange: (status: TaskStatus) => void
  onDelete: () => void
  onTransfer: () => void
}) {
  const progress = task.plannedMinutes
    ? Math.min(100, (task.actualMinutes / task.plannedMinutes) * 100)
    : 0

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border ${
        task.status === "COMPLETED"
          ? "bg-muted/50 opacity-70"
          : task.status === "IN_PROGRESS"
          ? "border-primary bg-primary/5"
          : "bg-background"
      }`}
    >
      <div className="cursor-grab text-muted-foreground">
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`font-medium ${
              task.status === "COMPLETED" ? "line-through" : ""
            }`}
          >
            {task.title}
          </span>
          <Badge className={STATUS_COLORS[task.status]}>
            {STATUS_LABELS[task.status]}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {task.actualMinutes || 0}/{task.plannedMinutes || 0} min
            </span>
          </div>
          {task.goal && (
            <span className="text-xs">
              Cel: {task.goal.title}
            </span>
          )}
        </div>

        {task.plannedMinutes && task.plannedMinutes > 0 && (
          <Progress value={progress} className="h-1 mt-2" />
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Timer button */}
        {task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
          <Button
            size="icon"
            variant={isTimerRunning ? "default" : "ghost"}
            onClick={onStartTimer}
            disabled={isTimerRunning}
          >
            {isTimerRunning ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Status actions */}
        {task.status === "NEW" && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onStatusChange("IN_PROGRESS")}
            title="Rozpocznij"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}

        {task.status === "IN_PROGRESS" && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onStatusChange("COMPLETED")}
            title="Zakończ"
          >
            <Check className="h-4 w-4 text-green-500" />
          </Button>
        )}

        {task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={onTransfer}
              title="Przenieś na jutro"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onStatusChange("CANCELLED")}
              title="Anuluj"
            >
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </>
        )}

        <Button size="icon" variant="ghost" onClick={onDelete} title="Usuń">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}
