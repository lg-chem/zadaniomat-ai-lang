"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckSquare,
  Target,
  Calendar,
  TrendingUp,
  Clock,
  BarChart3,
  Flame,
  Dumbbell,
} from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { format, startOfWeek, startOfMonth, subDays } from "date-fns"
import { pl } from "date-fns/locale"
import useSWR from "swr"

interface Stats {
  tasks: {
    total: number
    completed: number
    cancelled: number
    completionRate: number
  }
  goals: {
    total: number
    completed: number
    active: number
  }
  time: {
    totalMinutes: number
    averagePerDay: number
  }
  habits?: {
    total: number
    completed: number
    streak: number
  }
  sport?: {
    activitiesCount: number
    totalSteps: number
  }
}

export default function StatsPage() {
  const { workspace } = useWorkspaceStore()
  const [period, setPeriod] = useState<"week" | "month">("week")

  // Calculate date range
  const dateRange = useMemo(() => {
    const startDate =
      period === "week"
        ? startOfWeek(new Date(), { weekStartsOn: 1 })
        : startOfMonth(new Date())
    return {
      from: format(startDate, "yyyy-MM-dd"),
      to: format(new Date(), "yyyy-MM-dd"),
    }
  }, [period])

  // Fetch tasks with SWR
  const { data: tasks = [], isLoading: tasksLoading } = useSWR<any[]>(
    `/api/tasks?workspace=${workspace}&from=${dateRange.from}&to=${dateRange.to}`
  )

  // Fetch goals with SWR
  const { data: goals = [], isLoading: goalsLoading } = useSWR<any[]>(
    `/api/goals?workspace=${workspace}`
  )

  // Fetch private workspace data
  const { data: habits = [] } = useSWR<any[]>(
    workspace === "PRIVATE" ? "/api/habits" : null
  )
  const { data: sportActivities = [] } = useSWR<any[]>(
    workspace === "PRIVATE" ? `/api/sport/activities?from=${dateRange.from}&to=${dateRange.to}` : null
  )
  const { data: steps = [] } = useSWR<any[]>(
    workspace === "PRIVATE" ? `/api/sport/steps?from=${dateRange.from}&to=${dateRange.to}` : null
  )

  const isLoading = tasksLoading || goalsLoading

  // Calculate stats from fetched data
  const stats = useMemo<Stats | null>(() => {
    if (isLoading) return null

    const completedTasks = tasks.filter((t) => t.status === "COMPLETED")
    const cancelledTasks = tasks.filter((t) => t.status === "CANCELLED")
    const totalMinutes = tasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0)
    const daysInPeriod = period === "week" ? 7 : 30

    const statsData: Stats = {
      tasks: {
        total: tasks.length,
        completed: completedTasks.length,
        cancelled: cancelledTasks.length,
        completionRate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0,
      },
      goals: {
        total: goals.length,
        completed: goals.filter((g) => g.isCompleted).length,
        active: goals.filter((g) => !g.isCompleted).length,
      },
      time: {
        totalMinutes,
        averagePerDay: totalMinutes / daysInPeriod,
      },
    }

    if (workspace === "PRIVATE") {
      const totalSteps = steps.reduce((sum, s) => sum + s.count, 0)

      statsData.habits = {
        total: habits.length,
        completed: 0,
        streak: 0,
      }

      statsData.sport = {
        activitiesCount: sportActivities.length,
        totalSteps,
      }
    }

    return statsData
  }, [tasks, goals, habits, sportActivities, steps, period, workspace, isLoading])

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`
    const hrs = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            Statystyki
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Podsumowanie Twojej aktywności
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          <Badge
            variant={period === "week" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setPeriod("week")}
          >
            Tydzień
          </Badge>
          <Badge
            variant={period === "month" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setPeriod("month")}
          >
            Miesiąc
          </Badge>
        </div>
      </div>

      {/* Tasks Stats */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              Zadania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasks.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.tasks.completed} ukończonych
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Ukończenie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.tasks.completionRate)}%
            </div>
            <Progress value={stats.tasks.completionRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Czas pracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMinutes(stats.time.totalMinutes)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Śr. {formatMinutes(stats.time.averagePerDay)}/dzień
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Cele
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.goals.active}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.goals.completed} ukończonych
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PRIVATE workspace stats */}
      {workspace === "PRIVATE" && stats.habits && stats.sport && (
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          {/* Habits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Nawyki
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Wpisy</span>
                <span className="text-2xl font-bold">{stats.habits.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ukończone</span>
                <span className="text-xl font-semibold text-green-500">
                  {stats.habits.completed}
                </span>
              </div>
              <Progress
                value={
                  stats.habits.total > 0
                    ? (stats.habits.completed / stats.habits.total) * 100
                    : 0
                }
                className="h-2"
              />
            </CardContent>
          </Card>

          {/* Sport */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-blue-500" />
                Sport
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Aktywności</span>
                <span className="text-2xl font-bold">{stats.sport.activitiesCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Kroki</span>
                <span className="text-xl font-semibold text-purple-500">
                  {stats.sport.totalSteps.toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Cel: {(10000 * (period === "week" ? 7 : 30)).toLocaleString()} kroków
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
