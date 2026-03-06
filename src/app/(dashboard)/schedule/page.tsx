"use client"

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react"
import { toast } from "sonner"
import { format, addDays, subDays, isBefore, startOfDay } from "date-fns"
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
  Copy,
  AlertTriangle,
  Clock,
  LayoutGrid,
  Settings2,
  RotateCcw,
  Edit3,
  FileText,
  Pencil,
  Save,
  ListTodo,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Skeleton, SkeletonStats, SkeletonTable } from "@/components/ui/skeleton"
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
import { useTimerStore, formatMinutes } from "@/stores/timer-store"
import { useTasks, type Task, type TaskStatus } from "@/hooks/use-tasks"
import { useCategories, type Category } from "@/hooks/use-categories"
import { useSprints } from "@/hooks/use-sprints"
import { useTaskCounts } from "@/hooks/use-task-counts"
import { useOverdueTasks } from "@/hooks/use-overdue-tasks"
import { useDayBlocks, useScheduleOverride, type BlockData } from "@/hooks/use-schedule-blocks"
import { prefetchAdjacentDays } from "@/hooks/use-prefetch"
import { WeekStrip } from "@/components/schedule/week-strip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog"
import { SubtaskList, SubtaskProgress, type Subtask } from "@/components/tasks/subtask-list"
import { EditableDescription } from "@/components/tasks/editable-description"
import { ChevronDown, ChevronUp } from "lucide-react"

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

interface GoalTask {
  id: string
  title: string
  description?: string | null
  status: string
  priority: number
  plannedMinutes?: number | null
  scheduledDate?: string | null
  subtasks?: Subtask[]
  category?: { id: string; name: string; color: string } | null
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

  // Helper to get real-time actual minutes for a task (includes running timer)
  const getActualMinutes = (task: Task) => {
    if (timerStore.taskId === task.id && timerStore.isRunning) {
      // sessionDuration = only the time worked in the current session (not accumulated from previous stops)
      const sessionDuration = timerStore.elapsedSeconds - (timerStore.sessionStartElapsed || 0)
      return (task.actualMinutes || 0) + Math.ceil(sessionDuration / 60)
    }
    return task.actualMinutes || 0
  }

  const [selectedDate, setSelectedDate] = useState(new Date())
  const dateString = format(selectedDate, "yyyy-MM-dd")

  // Use SWR hooks for data fetching with cache
  const { tasks, isLoading: tasksLoading, mutate: mutateTasks, optimisticAdd, optimisticDelete, optimisticUpdate } = useTasks({ date: dateString })
  const { categories, isLoading: categoriesLoading } = useCategories()
  const { activeSprint } = useSprints()
  const { taskCounts, mutate: mutateTaskCounts, incrementCount, decrementCount } = useTaskCounts(selectedDate, 30)
  const { overdueTasks, mutate: mutateOverdue } = useOverdueTasks()

  // Schedule blocks for the selected date
  const { data: dayBlocksData, isOverride, blocks: dayBlocks, mutate: mutateDayBlocks } = useDayBlocks(dateString)
  const { saveOverride, removeOverride } = useScheduleOverride(dateString)

  // State for editing day blocks
  const [isEditingBlocks, setIsEditingBlocks] = useState(false)
  const [editedBlocks, setEditedBlocks] = useState<BlockData[]>([])

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

  // Dialog for adding task with custom date
  const [customDateTask, setCustomDateTask] = useState<{
    open: boolean
    title: string
    categoryId: string
    plannedMinutes: string
    scheduledDate: string
  }>({
    open: false,
    title: "",
    categoryId: "",
    plannedMinutes: "25",
    scheduledDate: format(new Date(), "yyyy-MM-dd"),
  })

  // Template inputs for strategic categories - keyed by categoryId
  const [templateInputs, setTemplateInputs] = useState<Record<string, {
    title: string
    plannedMinutes: string
    recurrenceRule: string
  }>>({})

  // Hidden templates for the day (user dismissed them)
  const [hiddenTemplates, setHiddenTemplates] = useState<Set<string>>(new Set())

  // Inline edit task state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  // Editing time state
  const [editingTimeTaskId, setEditingTimeTaskId] = useState<string | null>(null)
  const [editingTime, setEditingTime] = useState("")

  // Editing actual time state
  const [editingActualTimeTaskId, setEditingActualTimeTaskId] = useState<string | null>(null)
  const [editingActualTime, setEditingActualTime] = useState("")

  // Copy task state
  const [copyTaskId, setCopyTaskId] = useState<string | null>(null)

  // Transfer overdue task state (separate from copy)
  const [transferTaskId, setTransferTaskId] = useState<string | null>(null)

  // Full task edit dialog state
  const [editingFullTask, setEditingFullTask] = useState<Task | null>(null)

  // Expanded task state (for inline editing)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  // Sprint goals expansion and tasks state
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  const [goalTasksMap, setGoalTasksMap] = useState<Record<string, GoalTask[]>>({})
  const [expandedGoalTaskId, setExpandedGoalTaskId] = useState<string | null>(null)
  const [editingGoalTaskId, setEditingGoalTaskId] = useState<string | null>(null)
  const [editingGoalTaskTitle, setEditingGoalTaskTitle] = useState("")
  const [newGoalTaskTitles, setNewGoalTaskTitles] = useState<Record<string, string>>({})
  const [schedulingGoalTask, setSchedulingGoalTask] = useState<{ task: GoalTask; goalId: string } | null>(null)

  // Track dates for which we've already generated recurring tasks (per workspace)
  const generatedDatesRef = useRef<Set<string>>(new Set())

  // Generate recurring tasks on date change and reset hidden templates
  useEffect(() => {
    const cacheKey = `${dateString}-${workspace}`

    // Skip if we've already generated for this date+workspace combo
    if (generatedDatesRef.current.has(cacheKey)) {
      // Still reset UI state when navigating back to a date
      setHiddenTemplates(new Set())
      setTemplateInputs({})
      return
    }

    // Mark as generated immediately to prevent duplicate calls
    generatedDatesRef.current.add(cacheKey)

    // Generate recurring tasks in the background (don't await)
    fetch("/api/tasks/generate-recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateString, workspace }),
    })
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error("Failed to generate recurring tasks")
      })
      .then((data) => {
        // Only revalidate if new tasks were generated
        if (data?.generated > 0) {
          mutateTasks()
          mutateTaskCounts()
        }
      })
      .catch((error) => {
        console.error("Error generating recurring tasks:", error)
        // Remove from cache so it can retry on next visit
        generatedDatesRef.current.delete(cacheKey)
      })

    // Reset hidden templates when date changes
    setHiddenTemplates(new Set())
    setTemplateInputs({})
  }, [dateString, workspace, mutateTasks, mutateTaskCounts])

  // Prefetch adjacent days for faster navigation
  useEffect(() => {
    prefetchAdjacentDays(selectedDate, workspace)
  }, [selectedDate, workspace])

  // Fetch tasks for a specific sprint goal
  const fetchGoalTasks = useCallback(async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}/tasks`)
      if (res.ok) {
        const tasks = await res.json()
        setGoalTasksMap(prev => ({ ...prev, [goalId]: tasks }))
      }
    } catch (error) {
      console.error("Error fetching goal tasks:", error)
    }
  }, [])

  // Fetch tasks when a goal is expanded
  useEffect(() => {
    if (expandedGoalId && !goalTasksMap[expandedGoalId]) {
      fetchGoalTasks(expandedGoalId)
    }
  }, [expandedGoalId, goalTasksMap, fetchGoalTasks])

  const handlePrevDay = () => setSelectedDate((d) => subDays(d, 1))
  const handleNextDay = () => setSelectedDate((d) => addDays(d, 1))
  const handleToday = () => setSelectedDate(new Date())

  const handleCreateTask = () => {
    if (!newTask.title.trim()) return

    const isRecurring = newTask.recurrenceRule !== "none"
    const category = categories.find(c => c.id === newTask.categoryId)

    // Clear form immediately for instant feedback
    const taskData = { ...newTask }
    setNewTask({ title: "", categoryId: "", plannedMinutes: "25", recurrenceRule: "none" })
    setIsAddingTask(false)

    // Optimistic update for task count (instant)
    incrementCount(dateString)

    // Add task with optimistic UI update (don't await - let it run in background)
    optimisticAdd(
      {
        title: taskData.title,
        categoryId: taskData.categoryId || undefined,
        plannedMinutes: parseInt(taskData.plannedMinutes) || 25,
        scheduledDate: dateString,
        status: "NEW" as const,
        isRecurring,
        recurrenceRule: isRecurring ? taskData.recurrenceRule : null,
        category: category ? { id: category.id, name: category.name, color: category.color } : undefined,
      },
      async () => {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskData.title,
            categoryId: taskData.categoryId || undefined,
            plannedMinutes: parseInt(taskData.plannedMinutes) || 25,
            scheduledDate: dateString,
            orderInDay: tasks.length,
            workspaceType: workspace,
            status: "NEW",
            isRecurring,
            recurrenceRule: isRecurring ? taskData.recurrenceRule : null,
          }),
        })
        if (!res.ok) throw new Error('Failed to create task')
        return res.json()
      }
    ).catch((error) => {
      console.error("Error creating task:", error)
      toast.error("Nie udało się dodać zadania")
      // Rollback count on error
      decrementCount(dateString)
    })
  }

  // Handle creating task with custom date
  const handleCreateCustomDateTask = () => {
    if (!customDateTask.title.trim()) return

    // Close dialog immediately
    const taskData = { ...customDateTask }
    setCustomDateTask({
      open: false,
      title: "",
      categoryId: "",
      plannedMinutes: "25",
      scheduledDate: format(new Date(), "yyyy-MM-dd"),
    })

    // Optimistic update for task count
    incrementCount(taskData.scheduledDate)

    // Create task in background
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskData.title,
        categoryId: taskData.categoryId || undefined,
        plannedMinutes: parseInt(taskData.plannedMinutes) || 25,
        scheduledDate: taskData.scheduledDate,
        workspaceType: workspace,
        status: "NEW",
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to create task")
        // Refresh tasks if the selected date matches the custom date
        if (taskData.scheduledDate === dateString) {
          mutateTasks()
        }
        toast.success("Zadanie dodane")
      })
      .catch((error) => {
        console.error("Error creating task:", error)
        toast.error("Nie udało się dodać zadania")
        // Rollback count
        decrementCount(taskData.scheduledDate)
      })
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
  const handleCreateFromTemplate = (categoryId: string) => {
    const input = templateInputs[categoryId]
    if (!input?.title?.trim()) return

    const isRecurring = input.recurrenceRule !== "none"
    const category = categories.find(c => c.id === categoryId)

    // Clear input immediately for instant feedback
    const taskData = { ...input }
    setTemplateInputs((prev) => ({
      ...prev,
      [categoryId]: { title: "", plannedMinutes: "25", recurrenceRule: "none" },
    }))

    // Optimistic update for task count
    incrementCount(dateString)

    // Add task with optimistic UI update
    optimisticAdd(
      {
        title: taskData.title,
        categoryId,
        plannedMinutes: parseInt(taskData.plannedMinutes) || 25,
        scheduledDate: dateString,
        status: "NEW" as const,
        isRecurring,
        recurrenceRule: isRecurring ? taskData.recurrenceRule : null,
        category: category ? { id: category.id, name: category.name, color: category.color } : undefined,
      },
      async () => {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskData.title,
            categoryId,
            plannedMinutes: parseInt(taskData.plannedMinutes) || 25,
            scheduledDate: dateString,
            orderInDay: tasks.length,
            workspaceType: workspace,
            status: "NEW",
            isRecurring,
            recurrenceRule: isRecurring ? taskData.recurrenceRule : null,
          }),
        })
        if (!res.ok) throw new Error("Failed to create task")
        return res.json()
      }
    ).catch((error) => {
      console.error("Error creating task from template:", error)
      toast.error("Nie udało się dodać zadania")
      // Rollback count
      decrementCount(dateString)
    })
  }

  const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
    const updateData: Record<string, unknown> = { status }

    if (status === "COMPLETED") {
      updateData.completedAt = new Date().toISOString()
    }

    if (status === "IN_PROGRESS" && !timerStore.isRunning) {
      const task = tasks.find((t) => t.id === taskId)
      if (task) {
        timerStore.startTimer(taskId, task.title, task.plannedMinutes || undefined, task.actualMinutes || 0)
      }
    }

    try {
      await optimisticUpdate(taskId, { status }, async () => {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        })
        if (!res.ok) throw new Error('Failed to update task')
      })
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

  const handleDeleteTask = (taskId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie?")) return

    // Optimistic update for task count
    decrementCount(dateString)

    optimisticDelete(taskId, async () => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      if (!res.ok) throw new Error('Failed to delete task')
    })
      .then(() => {
        toast.success("Zadanie usunięte")
      })
      .catch((error) => {
        console.error("Error deleting task:", error)
        toast.error("Nie udało się usunąć zadania")
        // Rollback count
        incrementCount(dateString)
      })
  }

  const handleTransferTask = (taskId: string) => {
    const nextDay = format(addDays(selectedDate, 1), "yyyy-MM-dd")

    // Optimistic update for task counts (decrement today, increment tomorrow)
    decrementCount(dateString)
    incrementCount(nextDay)

    // Use optimistic delete since task will disappear from current day
    optimisticDelete(taskId, async () => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: nextDay,
          status: "NEW",
        }),
      })
      if (!res.ok) throw new Error('Failed to transfer task')
    })
      .then(() => {
        toast.success("Zadanie przeniesione na jutro")
      })
      .catch((error) => {
        console.error("Error transferring task:", error)
        toast.error("Nie udało się przenieść zadania")
        // Rollback counts
        incrementCount(dateString)
        decrementCount(nextDay)
      })
  }

  const handleStartTimer = (task: Task) => {
    timerStore.startTimer(task.id, task.title, task.plannedMinutes || undefined, task.actualMinutes || 0)
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

  // Start editing time
  const handleStartEditTime = (task: Task) => {
    setEditingTimeTaskId(task.id)
    setEditingTime(String(task.plannedMinutes || 25))
  }

  // Save edited time
  const handleSaveTime = async (taskId: string) => {
    if (!editingTime) {
      setEditingTimeTaskId(null)
      return
    }
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedMinutes: parseInt(editingTime) || 25 }),
      })
      mutateTasks()
      setEditingTimeTaskId(null)
    } catch (error) {
      console.error("Error updating task time:", error)
    }
  }

  // Start editing actual time
  const handleStartEditActualTime = (task: Task) => {
    setEditingActualTimeTaskId(task.id)
    setEditingActualTime(String(task.actualMinutes || 0))
  }

  // Save edited actual time
  const handleSaveActualTime = async (taskId: string) => {
    if (editingActualTime === "") {
      setEditingActualTimeTaskId(null)
      return
    }
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualMinutes: parseInt(editingActualTime) || 0 }),
      })
      mutateTasks()
      setEditingActualTimeTaskId(null)
    } catch (error) {
      console.error("Error updating actual time:", error)
    }
  }

  // Save time for a stopped timer session
  const saveStoppedTimerTime = async (taskId: string, sessionDurationSeconds: number) => {
    const sessionMinutes = Math.ceil(sessionDurationSeconds / 60)
    if (sessionMinutes <= 0) return
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualMinutesIncrement: sessionMinutes }),
      })
      mutateTasks()
    } catch (error) {
      console.error("Error saving stopped timer time:", error)
    }
  }

  // Timer toggle (play/pause/resume)
  const handleTimerToggle = (task: Task) => {
    if (timerStore.taskId === task.id) {
      // This task's timer is active
      if (timerStore.isPaused) {
        timerStore.resumeTimer()
      } else {
        timerStore.pauseTimer()
      }
    } else {
      // Stop previous timer first to save its time
      if (timerStore.isRunning && timerStore.taskId) {
        const result = timerStore.stopTimer()
        if (result) {
          saveStoppedTimerTime(result.taskId, result.sessionDurationSeconds)
        }
      }
      // Start new timer for this task
      timerStore.startTimer(task.id, task.title, task.plannedMinutes || undefined, task.actualMinutes || 0)
      handleUpdateTaskStatus(task.id, "IN_PROGRESS")
    }
  }

  // Copy task to selected date
  const handleCopyTask = async (taskId: string, targetDate: Date) => {
    const task = tasks.find(t => t.id === taskId) || overdueTasks.find(t => t.id === taskId)
    if (!task) return

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          categoryId: task.categoryId,
          plannedMinutes: task.plannedMinutes,
          scheduledDate: format(targetDate, "yyyy-MM-dd"),
          workspaceType: workspace,
          status: "NEW",
          isRecurring: false,
        }),
      })
      if (res.ok) {
        mutateTasks()
        mutateOverdue()
        setCopyTaskId(null)
      }
    } catch (error) {
      console.error("Error copying task:", error)
      toast.error("Nie udało się skopiować zadania")
    }
  }

  // Transfer overdue task to a date and mark original as transferred
  const handleTransferOverdue = async (taskId: string, targetDate: Date) => {
    const task = overdueTasks.find(t => t.id === taskId)
    if (!task) return

    const targetDateString = format(targetDate, "yyyy-MM-dd")
    const sourceDateString = task.scheduledDate ? format(new Date(task.scheduledDate), "yyyy-MM-dd") : null

    // Close popover immediately
    setTransferTaskId(null)

    // Optimistic update: decrement count for source date, increment for target date
    if (sourceDateString) {
      decrementCount(sourceDateString)
    }
    incrementCount(targetDateString)

    // Optimistic update: remove from overdue list immediately
    const updatedOverdue = overdueTasks.filter(t => t.id !== taskId)
    mutateOverdue(updatedOverdue, { revalidate: false })

    try {
      // Create new task on target date
      const createRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          categoryId: task.categoryId,
          plannedMinutes: task.plannedMinutes,
          scheduledDate: targetDateString,
          workspaceType: workspace,
          status: "NEW",
          isRecurring: false,
        }),
      })

      if (!createRes.ok) throw new Error("Failed to create task")

      // Mark original as transferred
      const updateRes = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "TO_TRANSFER" }),
      })

      if (!updateRes.ok) throw new Error("Failed to update original task")

      // Refresh tasks if we're viewing the target date
      if (targetDateString === dateString) {
        mutateTasks()
      }

      // Revalidate task counts to sync with server
      mutateTaskCounts()

      toast.success("Zadanie przeniesione")
    } catch (error) {
      console.error("Error transferring overdue task:", error)
      toast.error("Nie udało się przenieść zaległego zadania")
      // Rollback on error
      decrementCount(targetDateString)
      if (sourceDateString) {
        incrementCount(sourceDateString)
      }
      mutateOverdue() // Refetch to restore
    }
  }

  // Handle overdue task actions
  const handleOverdueAction = async (taskId: string, action: "complete" | "cancel") => {
    const status = action === "complete" ? "COMPLETED" : "CANCELLED"
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(action === "complete" ? { completedAt: new Date().toISOString() } : {})
        }),
      })
      mutateOverdue()
    } catch (error) {
      console.error("Error updating overdue task:", error)
    }
  }

  // Handle full task save from dialog
  const handleSaveFullTask = async (taskId: string, updates: Record<string, unknown>) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      mutateTasks()
    } catch (error) {
      console.error("Error saving task:", error)
      throw error
    }
  }

  // Handle subtasks change - optimistic update for immediate UI feedback
  const handleSubtasksChange = (taskId: string, newSubtasks: Subtask[]) => {
    const currentTasks = tasks ?? []
    const updatedTasks = currentTasks.map(task =>
      task.id === taskId ? { ...task, subtasks: newSubtasks } : task
    )
    // Update without revalidation - SubtaskList already saved to API
    mutateTasks(updatedTasks, { revalidate: false })
  }

  // === SPRINT GOAL TASK HANDLERS ===

  // Toggle category expansion
  const handleToggleCategoryExpand = (categoryId: string) => {
    setExpandedCategoryId(prev => prev === categoryId ? null : categoryId)
    setExpandedGoalId(null) // Close any expanded goal when switching categories
    setExpandedGoalTaskId(null)
  }

  // Toggle goal expansion
  const handleToggleGoalExpand = (goalId: string) => {
    setExpandedGoalId(prev => prev === goalId ? null : goalId)
    setExpandedGoalTaskId(null) // Close any expanded task when switching goals
  }

  // Complete/uncomplete a goal task
  const handleCompleteGoalTask = async (taskId: string, goalId: string) => {
    const currentTasks = goalTasksMap[goalId] || []
    const task = currentTasks.find(t => t.id === taskId)
    if (!task) return

    const newStatus = task.status === "COMPLETED" ? "NEW" : "COMPLETED"

    // Optimistic update
    setGoalTasksMap(prev => ({
      ...prev,
      [goalId]: prev[goalId].map(t =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    }))

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch (error) {
      console.error("Error updating task:", error)
      // Revert on error
      fetchGoalTasks(goalId)
    }
  }

  // Edit goal task title
  const handleEditGoalTask = (task: GoalTask) => {
    setEditingGoalTaskId(task.id)
    setEditingGoalTaskTitle(task.title)
  }

  const handleSaveGoalTaskEdit = async (taskId: string, goalId: string) => {
    if (!editingGoalTaskTitle.trim()) {
      handleCancelGoalTaskEdit()
      return
    }

    // Optimistic update
    setGoalTasksMap(prev => ({
      ...prev,
      [goalId]: prev[goalId].map(t =>
        t.id === taskId ? { ...t, title: editingGoalTaskTitle.trim() } : t
      )
    }))
    setEditingGoalTaskId(null)
    setEditingGoalTaskTitle("")

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingGoalTaskTitle.trim() }),
      })
    } catch (error) {
      console.error("Error updating task:", error)
      fetchGoalTasks(goalId)
    }
  }

  const handleCancelGoalTaskEdit = () => {
    setEditingGoalTaskId(null)
    setEditingGoalTaskTitle("")
  }

  // Add new task to goal
  const handleAddGoalTask = async (goalId: string) => {
    const title = newGoalTaskTitles[goalId]?.trim()
    if (!title) return

    // Clear input immediately
    setNewGoalTaskTitles(prev => ({ ...prev, [goalId]: "" }))

    try {
      const res = await fetch(`/api/goals/${goalId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })

      if (res.ok) {
        // Refresh tasks for this goal
        fetchGoalTasks(goalId)
        toast.success("Dodano zadanie")
      }
    } catch (error) {
      console.error("Error adding task:", error)
      toast.error("Błąd dodawania zadania")
    }
  }

  // Schedule goal task
  const handleScheduleGoalTask = async (taskId: string, goalId: string, date: Date) => {
    const scheduledDate = format(date, "yyyy-MM-dd")

    // Optimistic update
    setGoalTasksMap(prev => ({
      ...prev,
      [goalId]: prev[goalId].map(t =>
        t.id === taskId ? { ...t, scheduledDate } : t
      )
    }))
    setSchedulingGoalTask(null)

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate }),
      })
      toast.success(`Zaplanowano na ${format(date, "d MMM", { locale: pl })}`)
      // Refresh main task list if date matches
      if (scheduledDate === dateString) {
        mutateTasks()
      }
    } catch (error) {
      console.error("Error scheduling task:", error)
      fetchGoalTasks(goalId)
    }
  }

  // Handle goal task subtasks change
  const handleGoalTaskSubtasksChange = (taskId: string, goalId: string, newSubtasks: Subtask[]) => {
    setGoalTasksMap(prev => ({
      ...prev,
      [goalId]: prev[goalId].map(t =>
        t.id === taskId ? { ...t, subtasks: newSubtasks } : t
      )
    }))
  }

  const strategicCategories = categories.filter((c) => c.isStrategic)

  // Group tasks by status
  const taskGroups = {
    NEW: tasks.filter(t => t.status === "NEW"),
    IN_PROGRESS: tasks.filter(t => t.status === "IN_PROGRESS"),
    COMPLETED: tasks.filter(t => t.status === "COMPLETED"),
    CANCELLED: tasks.filter(t => t.status === "CANCELLED"),
  }

  // Calculate stats
  const totalPlanned = tasks.reduce((sum, t) => sum + (t.plannedMinutes || 0), 0)
  const totalActual = tasks.reduce((sum, t) => sum + getActualMinutes(t), 0)
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length

  // Get strategic categories that need template rows (no tasks yet and not hidden)
  const categoriesNeedingTemplates = strategicCategories.filter(
    (c) => !tasks.some((t) => t.categoryId === c.id) && !hiddenTemplates.has(c.id)
  )

  // Hide a template row
  const handleHideTemplate = (categoryId: string) => {
    setHiddenTemplates((prev) => new Set([...prev, categoryId]))
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>

        {/* Stats skeleton */}
        <Card>
          <CardContent className="py-4">
            <SkeletonStats />
          </CardContent>
        </Card>

        {/* Tasks skeleton */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <SkeletonTable rows={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
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

          {/* Date controls - desktop */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleToday}>
              Dziś
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[200px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  {format(selectedDate, "d MMMM yyyy", { locale: pl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={handleNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Week strip with task counts */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <WeekStrip
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            taskCounts={taskCounts}
          />

          {/* Mobile date controls */}
          <div className="flex md:hidden items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Dziś
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
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

      {/* Daily Schedule Blocks */}
      {dayBlocks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" />
                Bloki czasowe
                {isOverride && (
                  <Badge variant="secondary" className="text-xs">
                    Zmieniony
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {isEditingBlocks ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingBlocks(false)
                        setEditedBlocks([])
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Anuluj
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await saveOverride(editedBlocks)
                        mutateDayBlocks()
                        setIsEditingBlocks(false)
                        setEditedBlocks([])
                      }}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Zapisz dla tego dnia
                    </Button>
                  </>
                ) : (
                  <>
                    {isOverride && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await removeOverride()
                          mutateDayBlocks()
                        }}
                        title="Przywróć szablon"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditedBlocks(dayBlocks.map(b => ({
                          name: b.name,
                          description: b.description || undefined,
                          startTime: b.startTime,
                          endTime: b.endTime,
                          color: b.color || "#6366f1",
                          order: b.order || 0,
                        })))
                        setIsEditingBlocks(true)
                      }}
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edytuj dzień
                    </Button>
                    <Link href="/settings/weekly-schedule">
                      <Button size="sm" variant="ghost">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isEditingBlocks ? (
              <div className="space-y-2">
                {editedBlocks
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((block, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 border rounded-lg"
                      style={{ borderLeftColor: block.color, borderLeftWidth: 4 }}
                    >
                      <Input
                        type="time"
                        value={block.startTime}
                        onChange={(e) => {
                          const updated = [...editedBlocks]
                          updated[index] = { ...updated[index], startTime: e.target.value }
                          setEditedBlocks(updated)
                        }}
                        className="w-24 h-8"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={block.endTime}
                        onChange={(e) => {
                          const updated = [...editedBlocks]
                          updated[index] = { ...updated[index], endTime: e.target.value }
                          setEditedBlocks(updated)
                        }}
                        className="w-24 h-8"
                      />
                      <Input
                        value={block.name}
                        onChange={(e) => {
                          const updated = [...editedBlocks]
                          updated[index] = { ...updated[index], name: e.target.value }
                          setEditedBlocks(updated)
                        }}
                        placeholder="Nazwa bloku"
                        className="flex-1 h-8"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditedBlocks(editedBlocks.filter((_, i) => i !== index))
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditedBlocks([
                      ...editedBlocks,
                      {
                        name: "",
                        startTime: "09:00",
                        endTime: "10:00",
                        color: "#6366f1",
                        order: editedBlocks.length,
                      },
                    ])
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Dodaj blok
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dayBlocks
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((block, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30"
                      style={{ borderLeftColor: block.color || "#6366f1", borderLeftWidth: 3 }}
                    >
                      <span className="text-xs text-muted-foreground">
                        {block.startTime} - {block.endTime}
                      </span>
                      <span className="font-medium text-sm">{block.name}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sprint Goals - WORK only, grouped by category with expandable tasks */}
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
            <CardContent className="space-y-2">
              {Object.entries(goalsByCategory).map(([categoryId, { name, color, goals }]) => {
                const isCategoryExpanded = expandedCategoryId === categoryId
                const completedGoals = goals.filter(g => g.isCompleted).length

                return (
                  <div key={categoryId} className="rounded-lg border bg-muted/20">
                    {/* Category header - clickable to expand */}
                    <div
                      className="p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => handleToggleCategoryExpand(categoryId)}
                    >
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleCategoryExpand(categoryId)
                          }}
                        >
                          {isCategoryExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </Button>
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-medium flex-1">{name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {completedGoals}/{goals.length} celów
                        </Badge>
                      </div>
                    </div>

                    {/* Expanded goals section */}
                    {isCategoryExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-border/50">
                        <div className="space-y-2 mt-2 pl-5">
                          {goals.map((goal) => {
                            const progress = goal.targetValue
                              ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
                              : 0
                            const isGoalExpanded = expandedGoalId === goal.id
                            const goalTasks = goalTasksMap[goal.id] || []
                            const completedTasksCount = goalTasks.filter(t => t.status === "COMPLETED").length

                            return (
                              <div
                                key={goal.id}
                                className={`rounded-lg border ${
                                  goal.isCompleted ? "bg-green-50 border-green-200 dark:bg-green-950/20" : "bg-background"
                                }`}
                              >
                                {/* Goal header - clickable to expand */}
                                <div
                                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => handleToggleGoalExpand(goal.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggleGoalExpand(goal.id)
                                      }}
                                    >
                                      {isGoalExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </Button>
                                    <span className={`font-medium text-sm flex-1 ${goal.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                      {goal.title}
                                    </span>
                                    {goalTasks.length > 0 && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        {completedTasksCount}/{goalTasks.length} zadań
                                      </Badge>
                                    )}
                                    {goal.isCompleted && (
                                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    )}
                                  </div>
                                  {goal.targetValue && (
                                    <div className="mt-2 pl-7">
                                      <Progress value={progress} className="h-1.5 mb-1" />
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                                        <span>{Math.round(progress)}%</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Expanded tasks section */}
                                {isGoalExpanded && (
                                  <div className="px-3 pb-3 pt-0 border-t border-border/50">
                                    <div className="pl-7 space-y-2 mt-2">
                                      <div className="text-[10px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
                                        <ListTodo className="h-3 w-3" /> Zadania do wykonania
                                      </div>

                                      {/* Task list */}
                                      {goalTasks.map((task) => {
                                        const isTaskExpanded = expandedGoalTaskId === task.id
                                        const isTaskEditing = editingGoalTaskId === task.id
                                        const hasSubtasks = task.subtasks && task.subtasks.length > 0
                                        const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0
                                        const isScheduled = !!task.scheduledDate

                                        return (
                                          <div
                                            key={task.id}
                                            className={`rounded border bg-background ${
                                              task.status === "COMPLETED" ? "bg-green-50 dark:bg-green-950/20" : ""
                                            } ${isScheduled ? "border-blue-200" : ""}`}
                                          >
                                            <div className="flex items-center justify-between p-2">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <button
                                                  onClick={() => handleCompleteGoalTask(task.id, goal.id)}
                                                  className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                                    task.status === "COMPLETED" ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
                                                  }`}
                                                >
                                                  {task.status === "COMPLETED" && <Check className="h-3 w-3" />}
                                                </button>
                                                {isTaskEditing ? (
                                                  <div className="flex-1 flex gap-1">
                                                    <Input
                                                      value={editingGoalTaskTitle}
                                                      onChange={(e) => setEditingGoalTaskTitle(e.target.value)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                          handleSaveGoalTaskEdit(task.id, goal.id)
                                                        } else if (e.key === "Escape") {
                                                          handleCancelGoalTaskEdit()
                                                        }
                                                      }}
                                                      className="h-6 text-xs"
                                                      autoFocus
                                                    />
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-6 w-6"
                                                      onClick={() => handleSaveGoalTaskEdit(task.id, goal.id)}
                                                    >
                                                      <Save className="h-3 w-3 text-green-500" />
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-6 w-6"
                                                      onClick={handleCancelGoalTaskEdit}
                                                    >
                                                      <X className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <span className={`text-xs truncate ${task.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}`}>
                                                      {task.title}
                                                    </span>
                                                    {isScheduled && (
                                                      <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-700 shrink-0">
                                                        <Calendar className="h-2 w-2 mr-0.5" />
                                                        {format(new Date(task.scheduledDate!), "d MMM", { locale: pl })}
                                                      </Badge>
                                                    )}
                                                    {hasSubtasks && (
                                                      <Badge variant="outline" className="text-[9px] shrink-0">
                                                        {completedSubtasks}/{task.subtasks!.length}
                                                      </Badge>
                                                    )}
                                                    {task.plannedMinutes && (
                                                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        {task.plannedMinutes}min
                                                      </span>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                              {!isTaskEditing && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => handleEditGoalTask(task)}
                                                  >
                                                    <Pencil className="h-2.5 w-2.5" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => setExpandedGoalTaskId(isTaskExpanded ? null : task.id)}
                                                  >
                                                    {isTaskExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                                  </Button>
                                                  <Popover
                                                    open={schedulingGoalTask?.task.id === task.id}
                                                    onOpenChange={(open) => setSchedulingGoalTask(open ? { task, goalId: goal.id } : null)}
                                                  >
                                                    <PopoverTrigger asChild>
                                                      {!isScheduled ? (
                                                        <Button
                                                          variant="outline"
                                                          size="sm"
                                                          className="h-5 text-[10px] px-1.5"
                                                        >
                                                          <Calendar className="h-2.5 w-2.5 mr-0.5" />
                                                          Zaplanuj
                                                        </Button>
                                                      ) : (
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-5 text-[10px] px-1.5 text-blue-600"
                                                        >
                                                          <Calendar className="h-2.5 w-2.5 mr-0.5" />
                                                          Zmień
                                                        </Button>
                                                      )}
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="end">
                                                      <CalendarComponent
                                                        mode="single"
                                                        selected={task.scheduledDate ? new Date(task.scheduledDate) : undefined}
                                                        onSelect={(date) => date && handleScheduleGoalTask(task.id, goal.id, date)}
                                                        initialFocus
                                                      />
                                                    </PopoverContent>
                                                  </Popover>
                                                </div>
                                              )}
                                            </div>

                                            {/* Expanded task content - subtasks */}
                                            {isTaskExpanded && (
                                              <div className="px-2 pb-2 space-y-2 border-t pt-2 bg-muted/30">
                                                <div>
                                                  <div className="text-[10px] font-medium mb-1">Lista kontrolna</div>
                                                  <SubtaskList
                                                    taskId={task.id}
                                                    subtasks={task.subtasks || []}
                                                    onSubtasksChange={(newSubtasks) => handleGoalTaskSubtasksChange(task.id, goal.id, newSubtasks)}
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}

                                      {/* Add new task input */}
                                      <div className="flex gap-1 mt-2">
                                        <Input
                                          value={newGoalTaskTitles[goal.id] || ""}
                                          onChange={(e) => setNewGoalTaskTitles(prev => ({ ...prev, [goal.id]: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" && newGoalTaskTitles[goal.id]?.trim()) {
                                              handleAddGoalTask(goal.id)
                                            }
                                          }}
                                          placeholder="Dodaj zadanie..."
                                          className="h-6 text-xs"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handleAddGoalTask(goal.id)}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })()}

      {/* Overdue Tasks - Must be resolved */}
      {overdueTasks.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Zaległe zadania ({overdueTasks.length})
            </CardTitle>
            <p className="text-sm text-red-600/80 dark:text-red-400/80">
              Te zadania mają termin z przeszłości. Przenieś je na inny dzień, oznacz jako zakończone lub anuluj.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-red-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {task.category && (
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.category.color }} />
                    )}
                    <span className="font-medium truncate">{task.title}</span>
                    <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">
                      {task.scheduledDate ? format(new Date(task.scheduledDate), "d MMM", { locale: pl }) : "?"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {task.plannedMinutes && <span>{task.plannedMinutes} min</span>}
                    {task.category && <span className="ml-2">• {task.category.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Transfer to another day */}
                  <Popover open={transferTaskId === task.id} onOpenChange={(open) => setTransferTaskId(open ? task.id : null)}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-xs">
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Przenieś
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={undefined}
                        onSelect={(date) => date && handleTransferOverdue(task.id, date)}
                        disabled={(date) => isBefore(date, startOfDay(new Date()))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button size="sm" variant="outline" onClick={() => handleOverdueAction(task.id, "complete")} className="h-8 text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    Gotowe
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleOverdueAction(task.id, "cancel")} className="h-8 text-xs text-muted-foreground">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Task Table - Spreadsheet style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Zadania na dziś</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile View - Cards grouped by status */}
          <div className="space-y-4 md:hidden animate-stagger">
            {/* In Progress Tasks */}
            {taskGroups.IN_PROGRESS.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium text-blue-700">W trakcie ({taskGroups.IN_PROGRESS.length})</span>
                </div>
                {taskGroups.IN_PROGRESS.map((task) => (
                  <Card key={task.id} className="border-l-2 border-l-blue-500">
                    <CardContent className="p-3">
                      <div className="space-y-2">
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
                            <div className="flex-1 flex items-center gap-2 min-w-0" onClick={() => handleStartEdit(task)}>
                              {task.isRecurring && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                              <span className="text-sm font-medium truncate">{task.title}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {task.category && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.category.color }} />
                              <span>{task.category.name}</span>
                            </div>
                          )}
                          {task.plannedMinutes && <span className="text-muted-foreground">• {task.plannedMinutes} min</span>}
                          {task.subtasks && task.subtasks.length > 0 && <SubtaskProgress subtasks={task.subtasks} />}
                        </div>
                        <div className="flex items-center gap-1 pt-1">
                          <Button size="sm" onClick={() => handleUpdateTaskStatus(task.id, "COMPLETED")} className="h-7 text-xs">
                            Zakończ
                          </Button>
                          <Button size="sm" variant={expandedTaskId === task.id ? "default" : "outline"} onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)} className="h-7 text-xs">
                            {expandedTaskId === task.id ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                            Szczegóły
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingFullTask(task)} className="h-7 text-xs">
                            <Edit3 className="h-3 w-3 mr-1" />
                            Edytuj
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteTask(task.id)} className="h-7 text-xs">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {/* Expanded section */}
                        {expandedTaskId === task.id && (
                          <div className="pt-2 space-y-3 border-t mt-2">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis</label>
                              <EditableDescription
                                taskId={task.id}
                                initialValue={task.description}
                                onSaved={() => mutateTasks()}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Lista kontrolna</label>
                              <SubtaskList taskId={task.id} subtasks={task.subtasks || []} onSubtasksChange={(newSubtasks) => handleSubtasksChange(task.id, newSubtasks)} />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* New Tasks */}
            {taskGroups.NEW.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-sm font-medium text-slate-600">Nowe ({taskGroups.NEW.length})</span>
                </div>
                {taskGroups.NEW.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-3">
                      <div className="space-y-2">
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
                            <div className="flex-1 flex items-center gap-2 min-w-0" onClick={() => handleStartEdit(task)}>
                              {task.isRecurring && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                              <span className="text-sm font-medium truncate">{task.title}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {task.category && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.category.color }} />
                              <span>{task.category.name}</span>
                            </div>
                          )}
                          {task.plannedMinutes && <span className="text-muted-foreground">• {task.plannedMinutes} min</span>}
                          {task.subtasks && task.subtasks.length > 0 && <SubtaskProgress subtasks={task.subtasks} />}
                        </div>
                        <div className="flex items-center gap-1 pt-1">
                          <Button size="sm" variant="outline" onClick={() => handleStartTimer(task)} className="h-7 text-xs">
                            <Play className="h-3 w-3 mr-1" />
                            Start
                          </Button>
                          <Button size="sm" onClick={() => handleUpdateTaskStatus(task.id, "COMPLETED")} className="h-7 text-xs">
                            Zakończ
                          </Button>
                          <Button size="sm" variant={expandedTaskId === task.id ? "default" : "outline"} onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)} className="h-7 text-xs">
                            {expandedTaskId === task.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingFullTask(task)} className="h-7 text-xs">
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteTask(task.id)} className="h-7 text-xs">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {/* Expanded section */}
                        {expandedTaskId === task.id && (
                          <div className="pt-2 space-y-3 border-t mt-2">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis</label>
                              <EditableDescription
                                taskId={task.id}
                                initialValue={task.description}
                                onSaved={() => mutateTasks()}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Lista kontrolna</label>
                              <SubtaskList taskId={task.id} subtasks={task.subtasks || []} onSubtasksChange={(newSubtasks) => handleSubtasksChange(task.id, newSubtasks)} />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Completed Tasks */}
            {taskGroups.COMPLETED.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">Zakończone ({taskGroups.COMPLETED.length})</span>
                </div>
                {taskGroups.COMPLETED.map((task) => (
                  <Card key={task.id} className="opacity-60">
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 flex items-center gap-2 min-w-0" onClick={() => handleStartEdit(task)}>
                            {task.isRecurring && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                            <span className="text-sm font-medium line-through truncate">{task.title}</span>
                          </div>
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {task.category && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.category.color }} />
                              <span>{task.category.name}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 pt-1">
                          <Button size="sm" variant="outline" onClick={() => handleUpdateTaskStatus(task.id, "NEW")} className="h-7 text-xs">
                            Cofnij
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteTask(task.id)} className="h-7 text-xs">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Cancelled Tasks */}
            {taskGroups.CANCELLED.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-red-700">Anulowane ({taskGroups.CANCELLED.length})</span>
                </div>
                {taskGroups.CANCELLED.map((task) => (
                  <Card key={task.id} className="opacity-50 border-red-200">
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            {task.isRecurring && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                            <span className="text-sm font-medium line-through text-red-400 truncate">{task.title}</span>
                          </div>
                          <X className="h-4 w-4 text-red-500 flex-shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {task.category && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.category.color }} />
                              <span>{task.category.name}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 pt-1">
                          <Button size="sm" variant="outline" onClick={() => handleUpdateTaskStatus(task.id, "NEW")} className="h-7 text-xs">
                            Przywróć
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteTask(task.id)} className="h-7 text-xs">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Mobile Add Task Button/Form */}
            {isAddingTask ? (
              <Card className="border-primary">
                <CardContent className="p-3 space-y-3">
                  <Input
                    ref={newTaskRef}
                    placeholder="Nazwa zadania..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, handleCreateTask)}
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={newTask.categoryId || "none"}
                      onValueChange={(value) => setNewTask({ ...newTask, categoryId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Kategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Brak kategorii</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="5"
                      step="5"
                      value={newTask.plannedMinutes}
                      onChange={(e) => setNewTask({ ...newTask, plannedMinutes: e.target.value })}
                      placeholder="min"
                      className="h-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateTask} disabled={!newTask.title.trim()} className="flex-1">
                      <Check className="h-4 w-4 mr-2" />
                      Dodaj
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddingTask(false)
                        setNewTask({ title: "", categoryId: "", plannedMinutes: "25", recurrenceRule: "none" })
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleAddRowClick}
                  variant="outline"
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj zadanie
                </Button>
                <Button
                  onClick={() => setCustomDateTask((prev) => ({ ...prev, open: true, scheduledDate: format(new Date(), "yyyy-MM-dd") }))}
                  variant="outline"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Inny termin
                </Button>
              </div>
            )}
          </div>

          {/* Desktop View - Table */}
          <div className="border rounded-lg overflow-hidden hidden md:block">
            {/* Table Header */}
            <div className="grid grid-cols-[140px_minmax(120px,1fr)_55px_55px_auto] gap-2 p-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
              <div>Kategoria</div>
              <div>Nazwa zadania</div>
              <div className="text-center flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Plan
              </div>
              <div className="text-center">Real</div>
              <div>Akcje</div>
            </div>

            {/* Template rows for strategic categories without tasks */}
            {categoriesNeedingTemplates.map((category) => {
              const input = templateInputs[category.id] || { title: "", plannedMinutes: "25", recurrenceRule: "none" }
              return (
                <div
                  key={`template-${category.id}`}
                  className="grid grid-cols-[140px_minmax(120px,1fr)_55px_55px_auto] gap-2 p-3 border-b items-center bg-amber-50/50 dark:bg-amber-950/20"
                >
                  {/* Category - fixed */}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-xs font-medium truncate">{category.name}</span>
                  </div>

                  {/* Title Input */}
                  <div>
                    <Input
                      placeholder="Wpisz zadanie..."
                      value={input.title}
                      onChange={(e) => handleTemplateInputChange(category.id, "title", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && input.title.trim()) {
                          handleCreateFromTemplate(category.id)
                        }
                      }}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Planned Time */}
                  <div>
                    <Input
                      type="number"
                      min="5"
                      step="5"
                      value={input.plannedMinutes}
                      onChange={(e) => handleTemplateInputChange(category.id, "plannedMinutes", e.target.value)}
                      className="h-8 text-center text-xs"
                    />
                  </div>

                  {/* Actual Time - empty for new */}
                  <div className="text-center text-xs text-muted-foreground">-</div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3"
                      onClick={() => handleCreateFromTemplate(category.id)}
                      disabled={!input.title.trim()}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Dodaj
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2"
                      onClick={() => handleHideTemplate(category.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {/* Task Groups */}
            {/* In Progress Section */}
            {taskGroups.IN_PROGRESS.length > 0 && (
              <>
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-l-2 border-l-blue-500">
                  <div className="flex items-center gap-2">
                    <Play className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">W trakcie ({taskGroups.IN_PROGRESS.length})</span>
                  </div>
                </div>
                {taskGroups.IN_PROGRESS.map((task) => (
                  <div key={task.id} className="border-b border-l-2 border-l-blue-500">
                    <div className="grid grid-cols-[140px_minmax(120px,1fr)_55px_55px_auto] gap-2 p-3 items-center bg-primary/5">
                      <div>
                        <Select value={task.categoryId || "none"} onValueChange={(value) => handleUpdateTaskCategory(task.id, value === "none" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue>
                              {task.category ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.category.color }} />
                                  <span className="truncate">{task.category.name}</span>
                                </div>
                              ) : (<span className="text-muted-foreground">Brak</span>)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none"><span className="text-muted-foreground">Brak kategorii</span></SelectItem>
                            {categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</div></SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {editingTaskId === task.id ? (
                          <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onKeyDown={(e) => handleKeyDown(e, () => handleUpdateTaskTitle(task.id))} onBlur={() => handleUpdateTaskTitle(task.id)} className="h-8" autoFocus />
                        ) : (
                          <div className="cursor-text px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-2 flex-1 min-w-0" onClick={() => handleStartEdit(task)}>
                            {task.isRecurring && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                            <span className="truncate">{task.title}</span>
                          </div>
                        )}
                        {task.subtasks && task.subtasks.length > 0 && <SubtaskProgress subtasks={task.subtasks} />}
                      </div>
                      {/* Planned Time - click to edit */}
                      <div>
                        {editingTimeTaskId === task.id ? (
                          <Input type="number" min="5" step="5" value={editingTime} onChange={(e) => setEditingTime(e.target.value)} onBlur={() => handleSaveTime(task.id)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveTime(task.id); if (e.key === "Escape") setEditingTimeTaskId(null); }} className="h-7 text-center text-xs" autoFocus />
                        ) : (
                          <div className="text-center text-xs cursor-pointer hover:bg-muted rounded px-1 py-1" onClick={() => handleStartEditTime(task)}>{task.plannedMinutes || 25}</div>
                        )}
                      </div>
                      {/* Actual Time - click to edit */}
                      <div>
                        {editingActualTimeTaskId === task.id ? (
                          <Input type="number" min="0" step="1" value={editingActualTime} onChange={(e) => setEditingActualTime(e.target.value)} onBlur={() => handleSaveActualTime(task.id)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveActualTime(task.id); if (e.key === "Escape") setEditingActualTimeTaskId(null); }} className="h-7 text-center text-xs" autoFocus />
                        ) : (
                          <div className="text-center text-xs font-medium text-blue-600 cursor-pointer hover:bg-muted rounded px-1 py-1" onClick={() => handleStartEditActualTime(task)}>{getActualMinutes(task)}</div>
                        )}
                      </div>
                      {/* Actions - bigger buttons */}
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant={timerStore.taskId === task.id ? "default" : "outline"} className="h-9 px-3" onClick={() => handleTimerToggle(task)}>
                          {timerStore.taskId === task.id ? (timerStore.isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />) : <Play className="h-4 w-4 mr-1" />}
                          {timerStore.taskId === task.id ? (timerStore.isPaused ? "Wznów" : "Pauza") : "Start"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => handleUpdateTaskStatus(task.id, "COMPLETED")}>
                          <Check className="h-4 w-4 mr-1 text-green-500" />
                          Gotowe
                        </Button>
                        <Button size="sm" variant={expandedTaskId === task.id ? "default" : "ghost"} className="h-9 px-2" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)} title="Rozwiń szczegóły">
                          {expandedTaskId === task.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => setEditingFullTask(task)} title="Edytuj szczegóły">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Popover open={copyTaskId === task.id} onOpenChange={(open) => setCopyTaskId(open ? task.id : null)}>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-9 px-2"><Copy className="h-4 w-4" /></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent mode="single" selected={undefined} onSelect={(date) => date && handleCopyTask(task.id, date)} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => handleDeleteTask(task.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    {/* Expanded section with description and subtasks */}
                    {expandedTaskId === task.id && (
                      <div className="px-4 py-3 bg-muted/30 border-t space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis</label>
                          <EditableDescription
                            taskId={task.id}
                            initialValue={task.description}
                            onSaved={() => mutateTasks()}
                            placeholder="Dodaj opis zadania..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Lista kontrolna</label>
                          <SubtaskList
                            taskId={task.id}
                            subtasks={task.subtasks || []}
                            onSubtasksChange={(newSubtasks) => handleSubtasksChange(task.id, newSubtasks)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* New Tasks Section */}
            {taskGroups.NEW.length > 0 && (
              <>
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/30 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Nowe ({taskGroups.NEW.length})</span>
                  </div>
                </div>
                {taskGroups.NEW.map((task) => (
                  <div key={task.id} className="border-b hover:bg-muted/20 transition-colors">
                    <div className="grid grid-cols-[140px_minmax(120px,1fr)_55px_55px_auto] gap-2 p-3 items-center">
                      <div>
                        <Select value={task.categoryId || "none"} onValueChange={(value) => handleUpdateTaskCategory(task.id, value === "none" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue>
                              {task.category ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.category.color }} />
                                  <span className="truncate">{task.category.name}</span>
                                </div>
                              ) : (<span className="text-muted-foreground">Brak</span>)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none"><span className="text-muted-foreground">Brak kategorii</span></SelectItem>
                            {categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</div></SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {editingTaskId === task.id ? (
                          <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onKeyDown={(e) => handleKeyDown(e, () => handleUpdateTaskTitle(task.id))} onBlur={() => handleUpdateTaskTitle(task.id)} className="h-8" autoFocus />
                        ) : (
                          <div className="cursor-text px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-2 flex-1 min-w-0" onClick={() => handleStartEdit(task)}>
                            {task.isRecurring && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                            <span className="truncate">{task.title}</span>
                          </div>
                        )}
                        {task.subtasks && task.subtasks.length > 0 && <SubtaskProgress subtasks={task.subtasks} />}
                      </div>
                      {/* Planned Time - click to edit */}
                      <div>
                        {editingTimeTaskId === task.id ? (
                          <Input type="number" min="5" step="5" value={editingTime} onChange={(e) => setEditingTime(e.target.value)} onBlur={() => handleSaveTime(task.id)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveTime(task.id); if (e.key === "Escape") setEditingTimeTaskId(null); }} className="h-7 text-center text-xs" autoFocus />
                        ) : (
                          <div className="text-center text-xs cursor-pointer hover:bg-muted rounded px-1 py-1" onClick={() => handleStartEditTime(task)}>{task.plannedMinutes || 25}</div>
                        )}
                      </div>
                      {/* Actual Time - click to edit */}
                      <div>
                        {editingActualTimeTaskId === task.id ? (
                          <Input type="number" min="0" step="1" value={editingActualTime} onChange={(e) => setEditingActualTime(e.target.value)} onBlur={() => handleSaveActualTime(task.id)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveActualTime(task.id); if (e.key === "Escape") setEditingActualTimeTaskId(null); }} className="h-7 text-center text-xs" autoFocus />
                        ) : (
                          <div className="text-center text-xs text-muted-foreground cursor-pointer hover:bg-muted rounded px-1 py-1" onClick={() => handleStartEditActualTime(task)}>{getActualMinutes(task)}</div>
                        )}
                      </div>
                      {/* Actions - bigger buttons */}
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => handleTimerToggle(task)}>
                          <Play className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => handleUpdateTaskStatus(task.id, "COMPLETED")}>
                          <Check className="h-4 w-4 mr-1 text-green-500" />
                          Gotowe
                        </Button>
                        <Button size="sm" variant={expandedTaskId === task.id ? "default" : "ghost"} className="h-9 px-2" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)} title="Rozwiń szczegóły">
                          {expandedTaskId === task.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => setEditingFullTask(task)} title="Edytuj szczegóły">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Popover open={copyTaskId === task.id} onOpenChange={(open) => setCopyTaskId(open ? task.id : null)}>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-9 px-2"><Copy className="h-4 w-4" /></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent mode="single" selected={undefined} onSelect={(date) => date && handleCopyTask(task.id, date)} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => handleUpdateTaskStatus(task.id, "CANCELLED")}><X className="h-4 w-4 text-red-500" /></Button>
                        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => handleDeleteTask(task.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    {/* Expanded section with description and subtasks */}
                    {expandedTaskId === task.id && (
                      <div className="px-4 py-3 bg-muted/30 border-t space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis</label>
                          <EditableDescription
                            taskId={task.id}
                            initialValue={task.description}
                            onSaved={() => mutateTasks()}
                            placeholder="Dodaj opis zadania..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Lista kontrolna</label>
                          <SubtaskList
                            taskId={task.id}
                            subtasks={task.subtasks || []}
                            onSubtasksChange={(newSubtasks) => handleSubtasksChange(task.id, newSubtasks)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Completed Tasks Section */}
            {taskGroups.COMPLETED.length > 0 && (
              <>
                <div className="px-3 py-2 bg-green-50 dark:bg-green-950/30 border-b">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Zakończone ({taskGroups.COMPLETED.length})</span>
                  </div>
                </div>
                {taskGroups.COMPLETED.map((task) => (
                  <div key={task.id} className="grid grid-cols-[140px_minmax(120px,1fr)_55px_55px_auto] gap-2 p-3 border-b items-center bg-muted/30 opacity-60">
                    <div>
                      {task.category ? (
                        <div className="flex items-center gap-2 px-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.category.color }} />
                          <span className="text-xs truncate">{task.category.name}</span>
                        </div>
                      ) : (<span className="text-xs text-muted-foreground px-2">Brak</span>)}
                    </div>
                    <div className="min-w-0">
                      <div className="px-2 py-1 flex items-center gap-2 line-through text-muted-foreground min-w-0">
                        {task.isRecurring && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                        <span className="truncate">{task.title}</span>
                        <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      </div>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">{task.plannedMinutes || 0}</div>
                    <div className="text-center text-xs text-green-600">{getActualMinutes(task)}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => handleUpdateTaskStatus(task.id, "NEW")}><ArrowRight className="h-4 w-4 rotate-180" /></Button>
                      <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => handleDeleteTask(task.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Cancelled Tasks Section */}
            {taskGroups.CANCELLED.length > 0 && (
              <>
                <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b">
                  <div className="flex items-center gap-2">
                    <X className="h-3.5 w-3.5 text-red-600" />
                    <span className="text-sm font-medium text-red-700 dark:text-red-400">Anulowane ({taskGroups.CANCELLED.length})</span>
                  </div>
                </div>
                {taskGroups.CANCELLED.map((task) => (
                  <div key={task.id} className="grid grid-cols-[140px_minmax(120px,1fr)_55px_55px_auto] gap-2 p-3 border-b items-center bg-red-50/30 dark:bg-red-950/10 opacity-50">
                    <div>
                      {task.category ? (
                        <div className="flex items-center gap-2 px-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.category.color }} />
                          <span className="text-xs truncate">{task.category.name}</span>
                        </div>
                      ) : (<span className="text-xs text-muted-foreground px-2">Brak</span>)}
                    </div>
                    <div className="min-w-0">
                      <div className="px-2 py-1 flex items-center gap-2 line-through text-red-400 min-w-0">
                        {task.isRecurring && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                        <span className="truncate">{task.title}</span>
                        <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      </div>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">{task.plannedMinutes || 0}</div>
                    <div className="text-center text-xs text-muted-foreground">{getActualMinutes(task)}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => handleUpdateTaskStatus(task.id, "NEW")}><ArrowRight className="h-4 w-4 rotate-180" /></Button>
                      <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => handleDeleteTask(task.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Add New Task Row */}
            {isAddingTask ? (
              <div className="grid grid-cols-[140px_minmax(120px,1fr)_55px_55px_auto] gap-2 p-3 items-center bg-primary/5">
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

                {/* Planned Time Input */}
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

                {/* Actual Time - empty for new */}
                <div className="text-center text-xs text-muted-foreground">-</div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3"
                    onClick={handleCreateTask}
                    disabled={!newTask.title.trim()}
                  >
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                    Dodaj
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2"
                    onClick={() => {
                      setIsAddingTask(false)
                      setNewTask({ title: "", categoryId: "", plannedMinutes: "25", recurrenceRule: "none" })
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={handleAddRowClick}
                  className="flex-1 p-3 text-left text-muted-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Dodaj zadanie...
                </button>
                <button
                  onClick={() => setCustomDateTask((prev) => ({ ...prev, open: true, scheduledDate: format(new Date(), "yyyy-MM-dd") }))}
                  className="p-3 text-muted-foreground hover:bg-muted/30 transition-colors flex items-center gap-2 border-l"
                >
                  <Calendar className="h-4 w-4" />
                  Inny termin
                </button>
              </div>
            )}
          </div>

          {/* Empty state */}
          {tasks.length === 0 && categoriesNeedingTemplates.length === 0 && !isAddingTask && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak zadań na ten dzień</p>
              <p className="text-sm">Kliknij "Dodaj zadanie" aby zaplanować dzień</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for adding task with custom date */}
      <Dialog
        open={customDateTask.open}
        onOpenChange={(open) => setCustomDateTask((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj zadanie na inny termin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Tytuł</Label>
              <Input
                value={customDateTask.title}
                onChange={(e) => setCustomDateTask((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Co chcesz zrobić?"
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={customDateTask.scheduledDate}
                onChange={(e) => setCustomDateTask((prev) => ({ ...prev, scheduledDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select
                value={customDateTask.categoryId || "none"}
                onValueChange={(v) => setCustomDateTask((prev) => ({ ...prev, categoryId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak kategorii</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Czas (minuty)</Label>
              <Input
                type="number"
                value={customDateTask.plannedMinutes}
                onChange={(e) => setCustomDateTask((prev) => ({ ...prev, plannedMinutes: e.target.value }))}
              />
            </div>
            <Button
              onClick={handleCreateCustomDateTask}
              className="w-full"
              disabled={!customDateTask.title.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj zadanie
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Edit Dialog with description and subtasks */}
      <TaskEditDialog
        open={!!editingFullTask}
        onOpenChange={(open) => !open && setEditingFullTask(null)}
        task={editingFullTask}
        categories={categories}
        onSave={handleSaveFullTask}
        onSubtasksChange={handleSubtasksChange}
      />
    </div>
  )
}
