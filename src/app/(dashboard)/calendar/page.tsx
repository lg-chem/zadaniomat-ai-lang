"use client"

import { useState, useMemo } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns"
import { pl } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useTasks, type Task, type TaskStatus } from "@/hooks/use-tasks"

interface DayData {
  date: Date
  tasks: Task[]
  isCurrentMonth: boolean
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  NEW: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-400",
  TO_TRANSFER: "bg-orange-400",
}

export default function CalendarPage() {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Calculate month range
  const monthRange = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return {
      from: format(start, 'yyyy-MM-dd'),
      to: format(end, 'yyyy-MM-dd')
    }
  }, [currentMonth])

  // Use SWR for tasks with cache
  const { tasks, isLoading } = useTasks(monthRange)

  const handlePrevMonth = () => setCurrentMonth((m) => subMonths(m, 1))
  const handleNextMonth = () => setCurrentMonth((m) => addMonths(m, 1))
  const handleToday = () => setCurrentMonth(new Date())

  const handleDayClick = (date: Date) => {
    // Navigate to schedule page with the selected date
    const dateStr = format(date, "yyyy-MM-dd")
    router.push(`/schedule?date=${dateStr}`)
  }

  // Generate calendar grid
  const generateCalendarDays = (): DayData[] => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: DayData[] = []
    let day = calendarStart

    while (day <= calendarEnd) {
      const dayStr = format(day, "yyyy-MM-dd")
      const dayTasks = tasks.filter((t) => {
        if (!t.scheduledDate) return false
        const taskDate = format(new Date(t.scheduledDate), "yyyy-MM-dd")
        return taskDate === dayStr
      })

      days.push({
        date: new Date(day),
        tasks: dayTasks,
        isCurrentMonth: isSameMonth(day, currentMonth),
      })

      day = addDays(day, 1)
    }

    return days
  }

  const calendarDays = generateCalendarDays()
  const weekDays = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"]

  // Stats for the month
  const monthTasks = tasks.filter((t) => {
    if (!t.scheduledDate) return false
    return isSameMonth(new Date(t.scheduledDate), currentMonth)
  })
  const completedCount = monthTasks.filter((t) => t.status === "COMPLETED").length
  const totalPlanned = monthTasks.reduce((sum, t) => sum + (t.plannedMinutes || 0), 0)

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
          <h1 className="text-2xl md:text-3xl font-bold">Kalendarz</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Widok miesięczny zadań
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday}>
            <Calendar className="h-4 w-4 mr-2" />
            Dziś
          </Button>
          <div className="px-4 py-2 font-medium min-w-[180px] text-center text-lg">
            {format(currentMonth, "LLLL yyyy", { locale: pl })}
          </div>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <div className="text-sm text-muted-foreground">Zadania w miesiącu</div>
            <div className="text-2xl font-bold">{monthTasks.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Ukończone</div>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Planowany czas</div>
            <div className="text-2xl font-bold">{Math.round(totalPlanned / 60)}h {totalPlanned % 60}m</div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((dayData, index) => {
              const dayIsToday = isToday(dayData.date)
              const hasCompleted = dayData.tasks.some((t) => t.status === "COMPLETED")
              const hasInProgress = dayData.tasks.some((t) => t.status === "IN_PROGRESS")
              const hasNew = dayData.tasks.some((t) => t.status === "NEW")

              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(dayData.date)}
                  className={`
                    min-h-[100px] p-2 border rounded-lg cursor-pointer transition-colors
                    ${!dayData.isCurrentMonth ? "bg-muted/30 text-muted-foreground" : "hover:bg-muted/50"}
                    ${dayIsToday ? "ring-2 ring-primary bg-primary/5" : ""}
                  `}
                >
                  {/* Day number */}
                  <div className={`text-sm font-medium mb-1 ${dayIsToday ? "text-primary" : ""}`}>
                    {format(dayData.date, "d")}
                  </div>

                  {/* Task indicators */}
                  {dayData.tasks.length > 0 && (
                    <div className="space-y-1">
                      {/* Show first 3 tasks */}
                      {dayData.tasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-1 text-xs truncate"
                          title={task.title}
                        >
                          <div
                            className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_COLORS[task.status]}`}
                          />
                          <span
                            className={`truncate ${task.status === "COMPLETED" ? "line-through opacity-60" : ""}`}
                            style={{ color: task.category?.color }}
                          >
                            {task.title}
                          </span>
                        </div>
                      ))}

                      {/* Show +N more if there are more tasks */}
                      {dayData.tasks.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayData.tasks.length - 3} więcej
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status dots summary */}
                  {dayData.tasks.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {hasCompleted && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                      {hasInProgress && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                      {hasNew && <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-slate-400" />
          <span>Nowe</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span>W trakcie</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>Ukończone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-orange-400" />
          <span>Do przeniesienia</span>
        </div>
      </div>
    </div>
  )
}
