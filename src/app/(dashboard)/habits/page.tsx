"use client"

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react"
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  isToday,
  isSameDay,
} from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Flame,
  Trash2,
  X,
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

type HabitFrequency = "DAILY" | "WEEKLY" | "MONTHLY"

interface HabitCompletion {
  id: string
  date: string
  count: number
}

interface Habit {
  id: string
  name: string
  description?: string | null
  frequency: HabitFrequency
  targetCount: number
  color: string
  currentStreak: number
  longestStreak: number
  completions: HabitCompletion[]
}

const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#06b6d4", "#84cc16",
]

const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  DAILY: "Codziennie",
  WEEKLY: "Co tydzień",
  MONTHLY: "Co miesiąc",
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  // New habit form
  const [isAddingHabit, setIsAddingHabit] = useState(false)
  const [newHabit, setNewHabit] = useState({
    name: "",
    color: COLORS[0],
    frequency: "DAILY" as HabitFrequency,
  })
  const newHabitRef = useRef<HTMLInputElement>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchHabits = useCallback(async () => {
    const startDate = format(weekStart, "yyyy-MM-dd")
    const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd")

    try {
      const res = await fetch(
        `/api/habits?includeCompletions=true&startDate=${startDate}&endDate=${endDate}`
      )
      if (res.ok) {
        const data = await res.json()
        setHabits(data)
      }
    } catch (error) {
      console.error("Error fetching habits:", error)
    } finally {
      setIsLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    setIsLoading(true)
    fetchHabits()
  }, [fetchHabits])

  const handlePrevWeek = () => setWeekStart((w) => subWeeks(w, 1))
  const handleNextWeek = () => setWeekStart((w) => addWeeks(w, 1))
  const handleThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const handleCreateHabit = async () => {
    if (!newHabit.name.trim()) return

    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHabit),
      })
      if (res.ok) {
        fetchHabits()
        setNewHabit({ name: "", color: COLORS[0], frequency: "DAILY" })
        setIsAddingHabit(false)
      }
    } catch (error) {
      console.error("Error creating habit:", error)
    }
  }

  const handleToggleCompletion = async (habitId: string, date: Date) => {
    try {
      await fetch(`/api/habits/${habitId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: format(date, "yyyy-MM-dd") }),
      })
      fetchHabits()
    } catch (error) {
      console.error("Error toggling habit:", error)
    }
  }

  const handleDeleteHabit = async (habitId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten nawyk?")) return
    try {
      await fetch(`/api/habits/${habitId}`, { method: "DELETE" })
      fetchHabits()
    } catch (error) {
      console.error("Error deleting habit:", error)
    }
  }

  const isCompletedOnDate = (habit: Habit, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd")
    return habit.completions.some((c) => {
      const completionDate = format(new Date(c.date), "yyyy-MM-dd")
      return completionDate === dateStr
    })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
    if (e.key === "Escape") {
      setIsAddingHabit(false)
      setNewHabit({ name: "", color: COLORS[0], frequency: "DAILY" })
    }
  }

  const handleAddRowClick = () => {
    setIsAddingHabit(true)
    setTimeout(() => newHabitRef.current?.focus(), 0)
  }

  // Stats
  const totalCompletionsThisWeek = habits.reduce(
    (sum, h) => sum + h.completions.length,
    0
  )
  const maxStreak = habits.reduce((max, h) => Math.max(max, h.currentStreak), 0)

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
          <h1 className="text-3xl font-bold">Nawyki</h1>
          <p className="text-muted-foreground">
            Śledź codzienne nawyki i buduj streak
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleThisWeek}>
            Ten tydzień
          </Button>
          <div className="px-4 py-2 font-medium min-w-[200px] text-center">
            {format(weekStart, "d MMM", { locale: pl })} -{" "}
            {format(addDays(weekStart, 6), "d MMM yyyy", { locale: pl })}
          </div>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <div className="text-sm text-muted-foreground">Nawyki</div>
            <div className="text-2xl font-bold">{habits.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Wykonane w tym tygodniu</div>
            <div className="text-2xl font-bold text-green-600">{totalCompletionsThisWeek}</div>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <div>
              <div className="text-sm text-muted-foreground">Najdłuższy streak</div>
              <div className="text-2xl font-bold">{maxStreak} dni</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Habits Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tracker nawyków</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_repeat(7,60px)_80px_50px] gap-1 p-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
              <div>Nawyk</div>
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`text-center ${isToday(day) ? "text-primary font-bold" : ""}`}
                >
                  <div>{format(day, "EEE", { locale: pl })}</div>
                  <div className="text-xs">{format(day, "d")}</div>
                </div>
              ))}
              <div className="text-center">
                <Flame className="h-4 w-4 mx-auto" />
              </div>
              <div></div>
            </div>

            {/* Habit Rows */}
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="grid grid-cols-[1fr_repeat(7,60px)_80px_50px] gap-1 p-3 border-b last:border-b-0 items-center hover:bg-muted/20"
              >
                {/* Habit Name */}
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className="font-medium">{habit.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {FREQUENCY_LABELS[habit.frequency]}
                  </Badge>
                </div>

                {/* Day checkboxes */}
                {weekDays.map((day) => {
                  const completed = isCompletedOnDate(habit, day)
                  const isFuture = day > new Date()

                  return (
                    <div key={day.toISOString()} className="flex justify-center">
                      <button
                        onClick={() => !isFuture && handleToggleCompletion(habit.id, day)}
                        disabled={isFuture}
                        className={`
                          h-8 w-8 rounded-lg flex items-center justify-center transition-all
                          ${isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:scale-110"}
                          ${completed
                            ? "text-white"
                            : "border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
                          }
                        `}
                        style={{
                          backgroundColor: completed ? habit.color : "transparent",
                        }}
                      >
                        {completed && <Check className="h-4 w-4" />}
                      </button>
                    </div>
                  )
                })}

                {/* Streak */}
                <div className="text-center font-medium">
                  {habit.currentStreak > 0 && (
                    <span className="text-orange-500">{habit.currentStreak} 🔥</span>
                  )}
                </div>

                {/* Delete */}
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDeleteHabit(habit.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add New Habit Row */}
            {isAddingHabit ? (
              <div className="grid grid-cols-[1fr_repeat(7,60px)_80px_50px] gap-1 p-3 items-center bg-primary/5">
                <div className="flex items-center gap-2">
                  {/* Color picker */}
                  <div className="relative group">
                    <div
                      className="h-6 w-6 rounded-full cursor-pointer"
                      style={{ backgroundColor: newHabit.color }}
                    />
                    <div className="absolute left-0 top-8 z-10 hidden group-hover:flex flex-wrap gap-1 p-2 bg-popover border rounded-lg shadow-lg w-[120px]">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`h-5 w-5 rounded-full border transition-all ${
                            newHabit.color === color
                              ? "border-foreground scale-110"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewHabit({ ...newHabit, color })}
                        />
                      ))}
                    </div>
                  </div>

                  <Input
                    ref={newHabitRef}
                    placeholder="Nazwa nawyku..."
                    value={newHabit.name}
                    onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, handleCreateHabit)}
                    className="h-8 flex-1"
                  />

                  <Select
                    value={newHabit.frequency}
                    onValueChange={(v: HabitFrequency) =>
                      setNewHabit({ ...newHabit, frequency: v })
                    }
                  >
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Codziennie</SelectItem>
                      <SelectItem value="WEEKLY">Co tydzień</SelectItem>
                      <SelectItem value="MONTHLY">Co miesiąc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Empty cells for days */}
                {weekDays.map((day) => (
                  <div key={day.toISOString()} />
                ))}

                <div />

                {/* Save/Cancel */}
                <div className="flex justify-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCreateHabit}
                    disabled={!newHabit.name.trim()}
                  >
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setIsAddingHabit(false)
                      setNewHabit({ name: "", color: COLORS[0], frequency: "DAILY" })
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
                Dodaj nawyk...
              </button>
            )}
          </div>

          {/* Empty state */}
          {habits.length === 0 && !isAddingHabit && (
            <div className="text-center py-8 text-muted-foreground">
              <Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak nawyków</p>
              <p className="text-sm">Kliknij "Dodaj nawyk" aby zacząć śledzić</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
