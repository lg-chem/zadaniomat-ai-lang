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
  Clock,
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
import { useHabits } from "@/hooks/use-habits"

type HabitFrequency = "DAILY" | "WEEKLY" | "MONTHLY"

interface HabitCompletion {
  id: string
  date: string
  count: number
  minutes?: number | null
}

interface Habit {
  id: string
  name: string
  description?: string | null
  frequency: HabitFrequency
  targetCount: number
  defaultMinutes?: number | null
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
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  // Use SWR hook for habits with cache
  const { habits, isLoading, mutate: mutateHabits } = useHabits()

  // New habit form
  const [isAddingHabit, setIsAddingHabit] = useState(false)
  const [newHabit, setNewHabit] = useState({
    name: "",
    color: COLORS[0],
    frequency: "DAILY" as HabitFrequency,
    defaultMinutes: "",
  })
  const newHabitRef = useRef<HTMLInputElement>(null)

  // Time editing state
  const [editingTime, setEditingTime] = useState<{ habitId: string; date: string } | null>(null)
  const [timeValue, setTimeValue] = useState("")

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

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
        mutateHabits()
        setNewHabit({ name: "", color: COLORS[0], frequency: "DAILY", defaultMinutes: "" })
        setIsAddingHabit(false)
      }
    } catch (error) {
      console.error("Error creating habit:", error)
    }
  }

  const handleToggleCompletion = async (habitId: string, date: Date, minutes?: string) => {
    try {
      await fetch(`/api/habits/${habitId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(date, "yyyy-MM-dd"),
          ...(minutes !== undefined && { minutes }),
        }),
      })
      mutateHabits()
    } catch (error) {
      console.error("Error toggling habit:", error)
    }
  }

  const handleUpdateTime = async (habitId: string, date: string) => {
    if (!timeValue) {
      setEditingTime(null)
      return
    }
    try {
      await fetch(`/api/habits/${habitId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, minutes: timeValue }),
      })
      mutateHabits()
      setEditingTime(null)
      setTimeValue("")
    } catch (error) {
      console.error("Error updating time:", error)
    }
  }

  const handleDeleteHabit = async (habitId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten nawyk?")) return
    try {
      await fetch(`/api/habits/${habitId}`, { method: "DELETE" })
      mutateHabits()
    } catch (error) {
      console.error("Error deleting habit:", error)
    }
  }

  const getCompletionOnDate = (habit: Habit, date: Date): HabitCompletion | undefined => {
    const dateStr = format(date, "yyyy-MM-dd")
    return habit.completions.find((c) => {
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
      setEditingTime(null)
      setTimeValue("")
      setNewHabit({ name: "", color: COLORS[0], frequency: "DAILY", defaultMinutes: "" })
    }
  }

  const handleAddRowClick = () => {
    setIsAddingHabit(true)
    setTimeout(() => newHabitRef.current?.focus(), 0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    )
  }

  // Stats (after loading check to ensure habits is defined)
  const totalCompletionsThisWeek = habits.reduce(
    (sum, h) => sum + h.completions.length,
    0
  )
  const maxStreak = habits.reduce((max, h) => Math.max(max, h.currentStreak), 0)
  const totalMinutesThisWeek = habits.reduce((sum, h) => {
    return sum + h.completions.reduce((cSum, c) => cSum + (c.minutes || h.defaultMinutes || 0), 0)
  }, 0)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Nawyki</h1>
          <p className="text-sm md:text-base text-muted-foreground">
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
        <CardContent className="grid grid-cols-2 md:flex md:items-center gap-4 md:gap-8 py-4">
          <div>
            <div className="text-xs md:text-sm text-muted-foreground">Nawyki</div>
            <div className="text-xl md:text-2xl font-bold">{habits.length}</div>
          </div>
          <div>
            <div className="text-xs md:text-sm text-muted-foreground">Wykonane w tygodniu</div>
            <div className="text-xl md:text-2xl font-bold text-green-600">{totalCompletionsThisWeek}</div>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 md:h-5 md:w-5 text-orange-500 flex-shrink-0" />
            <div>
              <div className="text-xs md:text-sm text-muted-foreground">Najdłuższy streak</div>
              <div className="text-xl md:text-2xl font-bold">{maxStreak} dni</div>
            </div>
          </div>
          {totalMinutesThisWeek > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-blue-500 flex-shrink-0" />
              <div>
                <div className="text-xs md:text-sm text-muted-foreground">Czas w tygodniu</div>
                <div className="text-xl md:text-2xl font-bold">
                  {totalMinutesThisWeek >= 60
                    ? `${Math.floor(totalMinutesThisWeek / 60)}h ${totalMinutesThisWeek % 60}m`
                    : `${totalMinutesThisWeek}m`}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Habits Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Tracker nawyków</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile View - Cards */}
          <div className="space-y-3 md:hidden">
            {habits.map((habit) => (
              <Card key={habit.id}>
                <CardContent className="p-3">
                  <div className="space-y-3">
                    {/* Habit Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: habit.color }}
                        />
                        <span className="font-medium text-sm">{habit.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {FREQUENCY_LABELS[habit.frequency]}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDeleteHabit(habit.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>

                    {/* Streak Info */}
                    {habit.currentStreak > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-orange-500">
                        <Flame className="h-3.5 w-3.5" />
                        <span className="font-medium">{habit.currentStreak} dni streak</span>
                      </div>
                    )}

                    {/* Week Grid - Horizontal Scroll */}
                    <div className="overflow-x-auto -mx-3 px-3">
                      <div className="flex gap-2 min-w-max">
                        {weekDays.map((day) => {
                          const completion = getCompletionOnDate(habit, day)
                          const completed = !!completion
                          const isFuture = day > new Date()
                          const dateStr = format(day, "yyyy-MM-dd")
                          const isEditing = editingTime?.habitId === habit.id && editingTime?.date === dateStr

                          return (
                            <div key={day.toISOString()} className="flex flex-col items-center gap-1">
                              {/* Day label */}
                              <div className={`text-[10px] ${isToday(day) ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                <div>{format(day, "EEE", { locale: pl })}</div>
                                <div className="text-center">{format(day, "d")}</div>
                              </div>

                              {/* Checkbox */}
                              <button
                                onClick={() => !isFuture && handleToggleCompletion(habit.id, day)}
                                disabled={isFuture}
                                className={`
                                  h-10 w-10 rounded-lg flex items-center justify-center transition-all
                                  ${isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer active:scale-95"}
                                  ${completed
                                    ? "text-white shadow-sm"
                                    : "border-2 border-dashed border-muted-foreground/30"
                                  }
                                `}
                                style={{
                                  backgroundColor: completed ? habit.color : "transparent",
                                }}
                              >
                                {completed && <Check className="h-4 w-4" />}
                              </button>

                              {/* Time display/edit */}
                              {completed && (habit.defaultMinutes || completion.minutes) && (
                                isEditing ? (
                                  <Input
                                    type="number"
                                    value={timeValue}
                                    onChange={(e) => setTimeValue(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, () => handleUpdateTime(habit.id, dateStr))}
                                    onBlur={() => handleUpdateTime(habit.id, dateStr)}
                                    className="h-6 w-14 text-[10px] text-center p-0"
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingTime({ habitId: habit.id, date: dateStr })
                                      setTimeValue(completion.minutes?.toString() || habit.defaultMinutes?.toString() || "")
                                    }}
                                    className="text-[10px] text-muted-foreground flex items-center gap-0.5"
                                  >
                                    <Clock className="h-2.5 w-2.5" />
                                    {completion.minutes || habit.defaultMinutes}m
                                  </button>
                                )
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Mobile Add Habit Button */}
            {!isAddingHabit && (
              <Button
                onClick={handleAddRowClick}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj nawyk
              </Button>
            )}

            {/* Mobile Add Habit Form */}
            {isAddingHabit && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {/* Color picker */}
                      <div className="relative group">
                        <div
                          className="h-8 w-8 rounded-full cursor-pointer border-2 border-border"
                          style={{ backgroundColor: newHabit.color }}
                        />
                        <div className="absolute left-0 top-10 z-10 hidden group-hover:flex flex-wrap gap-1.5 p-2 bg-popover border rounded-lg shadow-lg w-[140px]">
                          {COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`h-6 w-6 rounded-full border-2 transition-all ${
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
                        className="h-9 flex-1"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Select
                        value={newHabit.frequency}
                        onValueChange={(v: HabitFrequency) =>
                          setNewHabit({ ...newHabit, frequency: v })
                        }
                      >
                        <SelectTrigger className="h-9 flex-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAILY">Codziennie</SelectItem>
                          <SelectItem value="WEEKLY">Co tydzień</SelectItem>
                          <SelectItem value="MONTHLY">Co miesiąc</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-1 flex-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="min"
                          value={newHabit.defaultMinutes}
                          onChange={(e) => setNewHabit({ ...newHabit, defaultMinutes: e.target.value })}
                          className="h-9 flex-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleCreateHabit}
                        disabled={!newHabit.name.trim()}
                        className="flex-1"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Dodaj
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsAddingHabit(false)
                          setNewHabit({ name: "", color: COLORS[0], frequency: "DAILY", defaultMinutes: "" })
                        }}
                        className="flex-1"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Anuluj
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {habits.length === 0 && !isAddingHabit && (
              <div className="text-center py-8 text-muted-foreground">
                <Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Brak nawyków</p>
                <p className="text-sm">Kliknij "Dodaj nawyk" aby zacząć śledzić</p>
              </div>
            )}
          </div>

          {/* Desktop View - Table */}
          <div className="border rounded-lg overflow-hidden hidden md:block">
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
                  {habit.defaultMinutes && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {habit.defaultMinutes}m
                    </span>
                  )}
                </div>

                {/* Day checkboxes */}
                {weekDays.map((day) => {
                  const completion = getCompletionOnDate(habit, day)
                  const completed = !!completion
                  const isFuture = day > new Date()
                  const dateStr = format(day, "yyyy-MM-dd")
                  const isEditing = editingTime?.habitId === habit.id && editingTime?.date === dateStr

                  return (
                    <div key={day.toISOString()} className="flex flex-col items-center gap-0.5">
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
                      {/* Time display/edit */}
                      {completed && (habit.defaultMinutes || completion.minutes) && (
                        isEditing ? (
                          <Input
                            type="number"
                            value={timeValue}
                            onChange={(e) => setTimeValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, () => handleUpdateTime(habit.id, dateStr))}
                            onBlur={() => handleUpdateTime(habit.id, dateStr)}
                            className="h-5 w-12 text-[10px] text-center p-0"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingTime({ habitId: habit.id, date: dateStr })
                              setTimeValue(completion.minutes?.toString() || habit.defaultMinutes?.toString() || "")
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                          >
                            <Clock className="h-2.5 w-2.5" />
                            {completion.minutes || habit.defaultMinutes}m
                          </button>
                        )
                      )}
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

                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="min"
                      value={newHabit.defaultMinutes}
                      onChange={(e) => setNewHabit({ ...newHabit, defaultMinutes: e.target.value })}
                      className="h-8 w-16 text-xs"
                    />
                  </div>
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
                      setNewHabit({ name: "", color: COLORS[0], frequency: "DAILY", defaultMinutes: "" })
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

            {/* Desktop Empty state */}
            {habits.length === 0 && !isAddingHabit && (
              <div className="text-center py-8 text-muted-foreground">
                <Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Brak nawyków</p>
                <p className="text-sm">Kliknij "Dodaj nawyk" aby zacząć śledzić</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
