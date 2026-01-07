"use client"

import { useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Layers,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useSWR from "swr"

interface Task {
  id: string
  title: string
  description?: string
  priority: number
  plannedMinutes?: number
  status: string
  createdAt: string
  category?: {
    id: string
    name: string
    color: string
  }
  user: {
    id: string
    name: string
    email: string
  }
  organization?: {
    id: string
    name: string
  }
}

const priorityLabels: Record<number, { label: string; color: string }> = {
  0: { label: "Brak", color: "bg-gray-100 text-gray-600" },
  1: { label: "Niski", color: "bg-blue-100 text-blue-700" },
  2: { label: "Średni", color: "bg-yellow-100 text-yellow-700" },
  3: { label: "Wysoki", color: "bg-red-100 text-red-700" },
}

export default function TaskStackPage() {
  const { data: tasks, isLoading, mutate } = useSWR<Task[]>("/api/tasks/stack")

  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null)
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), "yyyy-MM-dd"))

  const handleScheduleTask = async () => {
    if (!schedulingTask) return

    try {
      const res = await fetch(`/api/tasks/${schedulingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: scheduleDate,
        }),
      })

      if (res.ok) {
        mutate()
        setSchedulingTask(null)
      }
    } catch (error) {
      console.error("Error scheduling task:", error)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
        }),
      })

      if (res.ok) {
        mutate()
      }
    } catch (error) {
      console.error("Error completing task:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Layers className="h-7 w-7" />
          Stos zadań
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Zadania przydzielone przez innych, które musisz zaplanować w swoim harmonogramie
        </p>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <div className="text-sm text-muted-foreground">Do zaplanowania</div>
            <div className="text-2xl font-bold">{tasks?.length || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Wysoki priorytet</div>
            <div className="text-2xl font-bold text-red-500">
              {tasks?.filter((t) => t.priority === 3).length || 0}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>Przydzielone zadania</CardTitle>
          <CardDescription>
            Kliknij "Zaplanuj" aby dodać zadanie do swojego harmonogramu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Stos jest pusty</p>
              <p className="text-sm">Nie masz żadnych nieprzydzielonych zadań</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{task.title}</span>
                      {task.category && (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: task.category.color,
                            color: task.category.color,
                          }}
                        >
                          {task.category.name}
                        </Badge>
                      )}
                      {task.priority > 0 && (
                        <Badge className={priorityLabels[task.priority].color}>
                          {priorityLabels[task.priority].label}
                        </Badge>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Od: {task.user.name || task.user.email}
                      </span>
                      {task.organization && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {task.organization.name}
                        </span>
                      )}
                      {task.plannedMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.plannedMinutes} min
                        </span>
                      )}
                      <span>
                        {format(new Date(task.createdAt), "d MMM yyyy", { locale: pl })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCompleteTask(task.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Gotowe
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSchedulingTask(task)
                        setScheduleDate(format(new Date(), "yyyy-MM-dd"))
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Zaplanuj
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={!!schedulingTask} onOpenChange={(open) => !open && setSchedulingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zaplanuj zadanie</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">{schedulingTask?.title}</div>
              {schedulingTask?.category && (
                <Badge
                  variant="outline"
                  className="mt-2"
                  style={{
                    borderColor: schedulingTask.category.color,
                    color: schedulingTask.category.color,
                  }}
                >
                  {schedulingTask.category.name}
                </Badge>
              )}
            </div>

            <div>
              <Label>Data wykonania</Label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulingTask(null)}>
              Anuluj
            </Button>
            <Button onClick={handleScheduleTask}>
              <Calendar className="h-4 w-4 mr-2" />
              Zaplanuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
