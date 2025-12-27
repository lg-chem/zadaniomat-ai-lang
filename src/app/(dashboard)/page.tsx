"use client"

import { useEffect, useState, useCallback } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Calendar, Target, Timer, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TaskItem } from "@/components/tasks/task-item"
import { QuickAddTask } from "@/components/tasks/quick-add-task"
import { GlobalTimer } from "@/components/timer/global-timer"
import { useWorkspaceStore } from "@/stores/workspace-store"

interface Category {
  id: string
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: number
  plannedMinutes?: number | null
  actualMinutes: number
  scheduledTime?: string | null
  category?: Category | null
}

export default function DashboardPage() {
  const { workspace } = useWorkspaceStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const today = new Date()
  const dateStr = format(today, "yyyy-MM-dd")

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?workspace=${workspace}&date=${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (error) {
      console.error("Error fetching tasks:", error)
    } finally {
      setIsLoading(false)
    }
  }, [workspace, dateStr])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleAddTask = async (title: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          scheduledDate: dateStr,
          workspaceType: workspace,
        }),
      })

      if (res.ok) {
        const newTask = await res.json()
        setTasks((prev) => [...prev, newTask])
      }
    } catch (error) {
      console.error("Error adding task:", error)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (res.ok) {
        const updatedTask = await res.json()
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? updatedTask : t))
        )
      }
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleTimeAdd = async (id: string, duration: number) => {
    try {
      await fetch(`/api/tasks/${id}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration }),
      })
      fetchTasks()
    } catch (error) {
      console.error("Error adding time:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" })
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id))
      }
    } catch (error) {
      console.error("Error deleting task:", error)
    }
  }

  // Stats
  const completedTasks = tasks.filter((t) => t.status === "DONE").length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const totalPlannedMinutes = tasks.reduce((acc, t) => acc + (t.plannedMinutes || 0), 0)
  const totalActualMinutes = tasks.reduce((acc, t) => acc + t.actualMinutes, 0)

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  }

  const todoTasks = tasks.filter((t) => t.status !== "DONE")
  const doneTasks = tasks.filter((t) => t.status === "DONE")

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          {format(today, "EEEE", { locale: pl })}
        </h1>
        <p className="text-muted-foreground">
          {format(today, "d MMMM yyyy", { locale: pl })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Postęp dnia</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <Progress value={completionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedTasks} z {totalTasks} zadań
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Czas pracy</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(totalActualMinutes)}</div>
            {totalPlannedMinutes > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Plan: {formatMinutes(totalPlannedMinutes)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Do zrobienia</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoTasks.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              zadań pozostało
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukończone</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{doneTasks.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              zadań dzisiaj
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* To Do */}
        <Card>
          <CardHeader>
            <CardTitle>Do zrobienia</CardTitle>
            <CardDescription>
              Zadania zaplanowane na dziś
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-4">Ładowanie...</p>
            ) : todoTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Brak zadań na dziś. Dodaj nowe!
              </p>
            ) : (
              todoTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onTimeAdd={handleTimeAdd}
                  onDelete={handleDelete}
                />
              ))
            )}
            <QuickAddTask onAdd={handleAddTask} />
          </CardContent>
        </Card>

        {/* Done */}
        <Card>
          <CardHeader>
            <CardTitle>Ukończone</CardTitle>
            <CardDescription>
              Zadania zakończone dzisiaj
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {doneTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Jeszcze nic nie ukończono
              </p>
            ) : (
              doneTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onTimeAdd={handleTimeAdd}
                  onDelete={handleDelete}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Global Timer */}
      <GlobalTimer onStop={handleTimeAdd} />
    </div>
  )
}
