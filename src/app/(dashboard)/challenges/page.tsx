"use client"

import { useEffect, useState, useCallback, KeyboardEvent } from "react"
import {
  format,
  differenceInDays,
  startOfWeek,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  getWeek,
  getMonth,
} from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Check,
  Trash2,
  X,
  Trophy,
  Calendar,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface ChallengeEntry {
  id: string
  date: string
  value: number
  notes?: string | null
}

interface ChallengeMilestone {
  id: string
  name: string
  targetValue: number
  isReached: boolean
}

type ChallengeType = "NUMERIC" | "WEEKLY_HABIT" | "MONTHLY_GOAL"

interface Challenge {
  id: string
  name: string
  description?: string | null
  challengeType: ChallengeType
  startDate: string
  endDate: string
  targetValue: number
  currentValue: number
  unit: string
  weeklyTarget?: number | null
  isCompleted: boolean
  color: string
  milestones: ChallengeMilestone[]
  entries: ChallengeEntry[]
}

const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  NUMERIC: "Cel liczbowy",
  WEEKLY_HABIT: "Nawyk tygodniowy",
  MONTHLY_GOAL: "Cel miesięczny",
}

const COLORS = [
  "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
]

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // New challenge form
  const [newChallenge, setNewChallenge] = useState({
    name: "",
    description: "",
    challengeType: "NUMERIC" as ChallengeType,
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    targetValue: "",
    unit: "",
    weeklyTarget: "",
    color: COLORS[0],
  })

  // Add progress
  const [addingProgressId, setAddingProgressId] = useState<string | null>(null)
  const [progressValue, setProgressValue] = useState("")

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges?showCompleted=${showCompleted}`)
      if (res.ok) {
        const data = await res.json()
        setChallenges(data)
      }
    } catch (error) {
      console.error("Error fetching challenges:", error)
    } finally {
      setIsLoading(false)
    }
  }, [showCompleted])

  useEffect(() => {
    setIsLoading(true)
    fetchChallenges()
  }, [fetchChallenges])

  const handleCreateChallenge = async () => {
    if (!newChallenge.name || !newChallenge.endDate || !newChallenge.targetValue || !newChallenge.unit) {
      return
    }

    // For weekly habits, weeklyTarget is required
    if (newChallenge.challengeType === "WEEKLY_HABIT" && !newChallenge.weeklyTarget) {
      return
    }

    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newChallenge),
      })
      if (res.ok) {
        fetchChallenges()
        setNewChallenge({
          name: "",
          description: "",
          challengeType: "NUMERIC",
          startDate: format(new Date(), "yyyy-MM-dd"),
          endDate: "",
          targetValue: "",
          unit: "",
          weeklyTarget: "",
          color: COLORS[0],
        })
        setIsDialogOpen(false)
      }
    } catch (error) {
      console.error("Error creating challenge:", error)
    }
  }

  const handleAddProgress = async (challengeId: string) => {
    if (!progressValue) return

    try {
      await fetch(`/api/challenges/${challengeId}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: progressValue }),
      })
      fetchChallenges()
      setAddingProgressId(null)
      setProgressValue("")
    } catch (error) {
      console.error("Error adding progress:", error)
    }
  }

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to wyzwanie?")) return
    try {
      await fetch(`/api/challenges/${id}`, { method: "DELETE" })
      fetchChallenges()
    } catch (error) {
      console.error("Error deleting challenge:", error)
    }
  }

  const handleToggleDay = async (challengeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    try {
      await fetch(`/api/challenges/${challengeId}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 1, date: dateStr, toggle: true }),
      })
      fetchChallenges()
    } catch (error) {
      console.error("Error toggling day:", error)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
    if (e.key === "Escape") {
      setAddingProgressId(null)
      setProgressValue("")
    }
  }

  // Check if a day has an entry
  const isDayCompleted = (challenge: Challenge, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd")
    return challenge.entries.some((e) => format(new Date(e.date), "yyyy-MM-dd") === dateStr)
  }

  // Get current week days
  const getCurrentWeekDays = () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  // Get months for monthly goal
  const getMonthsInRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months: Date[] = []
    const current = startOfMonth(start)
    while (current <= end) {
      months.push(new Date(current))
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }

  // Stats
  const activeCount = challenges.filter((c) => !c.isCompleted).length
  const completedCount = challenges.filter((c) => c.isCompleted).length

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
          <h1 className="text-3xl font-bold">Wyzwania</h1>
          <p className="text-muted-foreground">
            Ustaw cele i śledź postępy
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={showCompleted}
              onCheckedChange={setShowCompleted}
            />
            <span className="text-sm text-muted-foreground">Pokaż ukończone</span>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nowe wyzwanie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nowe wyzwanie</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Challenge Type Toggle */}
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                      newChallenge.challengeType === "NUMERIC"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setNewChallenge({ ...newChallenge, challengeType: "NUMERIC", unit: "" })}
                  >
                    Cel liczbowy
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                      newChallenge.challengeType === "WEEKLY_HABIT"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setNewChallenge({ ...newChallenge, challengeType: "WEEKLY_HABIT", unit: "tygodni" })}
                  >
                    Nawyk tyg.
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                      newChallenge.challengeType === "MONTHLY_GOAL"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setNewChallenge({ ...newChallenge, challengeType: "MONTHLY_GOAL", unit: "miesięcy" })}
                  >
                    Cel mies.
                  </button>
                </div>

                <div>
                  <Label>Nazwa</Label>
                  <Input
                    value={newChallenge.name}
                    onChange={(e) => setNewChallenge({ ...newChallenge, name: e.target.value })}
                    placeholder={
                      newChallenge.challengeType === "WEEKLY_HABIT"
                        ? "np. Gotować w domu"
                        : newChallenge.challengeType === "MONTHLY_GOAL"
                        ? "np. Wpłata na oszczędności"
                        : "np. 100 km biegania"
                    }
                  />
                </div>
                <div>
                  <Label>Opis (opcjonalnie)</Label>
                  <Input
                    value={newChallenge.description}
                    onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                    placeholder={
                      newChallenge.challengeType === "MONTHLY_GOAL"
                        ? "np. 500 zł na konto oszczędnościowe"
                        : "Szczegóły wyzwania..."
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data rozpoczęcia</Label>
                    <Input
                      type="date"
                      value={newChallenge.startDate}
                      onChange={(e) => setNewChallenge({ ...newChallenge, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data zakończenia</Label>
                    <Input
                      type="date"
                      value={newChallenge.endDate}
                      onChange={(e) => setNewChallenge({ ...newChallenge, endDate: e.target.value })}
                    />
                  </div>
                </div>

                {newChallenge.challengeType === "WEEKLY_HABIT" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Ile razy w tygodniu</Label>
                      <Input
                        type="number"
                        min="1"
                        max="7"
                        value={newChallenge.weeklyTarget}
                        onChange={(e) => setNewChallenge({ ...newChallenge, weeklyTarget: e.target.value })}
                        placeholder="np. 3"
                      />
                    </div>
                    <div>
                      <Label>Cel (liczba tygodni)</Label>
                      <Input
                        type="number"
                        value={newChallenge.targetValue}
                        onChange={(e) => setNewChallenge({ ...newChallenge, targetValue: e.target.value })}
                        placeholder="np. 12"
                      />
                    </div>
                  </div>
                ) : newChallenge.challengeType === "MONTHLY_GOAL" ? (
                  <div>
                    <Label>Cel (liczba miesięcy)</Label>
                    <Input
                      type="number"
                      value={newChallenge.targetValue}
                      onChange={(e) => setNewChallenge({ ...newChallenge, targetValue: e.target.value })}
                      placeholder="np. 12"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Raz w miesiącu będziesz odznaczać wykonanie celu
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Cel</Label>
                      <Input
                        type="number"
                        value={newChallenge.targetValue}
                        onChange={(e) => setNewChallenge({ ...newChallenge, targetValue: e.target.value })}
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <Label>Jednostka</Label>
                      <Input
                        value={newChallenge.unit}
                        onChange={(e) => setNewChallenge({ ...newChallenge, unit: e.target.value })}
                        placeholder="km, dni, sesji..."
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label>Kolor</Label>
                  <div className="flex gap-2 mt-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          newChallenge.color === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewChallenge({ ...newChallenge, color })}
                      />
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreateChallenge} className="w-full">
                  Utwórz wyzwanie
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <div className="text-sm text-muted-foreground">Aktywne wyzwania</div>
            <div className="text-2xl font-bold">{activeCount}</div>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="text-sm text-muted-foreground">Ukończone</div>
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Challenges Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {challenges.map((challenge) => {
          const progress = (challenge.currentValue / challenge.targetValue) * 100
          const progressCapped = Math.min(100, progress)
          const isExceeded = progress > 100
          const daysLeft = differenceInDays(new Date(challenge.endDate), new Date())
          const isOverdue = daysLeft < 0 && !challenge.isCompleted
          const weekDays = getCurrentWeekDays()
          const months = challenge.challengeType === "MONTHLY_GOAL"
            ? getMonthsInRange(challenge.startDate, challenge.endDate)
            : []

          return (
            <Card
              key={challenge.id}
              className={`${challenge.isCompleted && !isExceeded ? "opacity-60" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: challenge.color }}
                    />
                    <CardTitle className="text-base">{challenge.name}</CardTitle>
                    {challenge.challengeType === "WEEKLY_HABIT" && (
                      <Badge variant="secondary" className="text-[10px]">
                        {challenge.weeklyTarget}x/tyg
                      </Badge>
                    )}
                    {challenge.challengeType === "MONTHLY_GOAL" && (
                      <Badge variant="secondary" className="text-[10px]">
                        1x/mies
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {isExceeded && (
                      <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                        🎉 Przekroczono!
                      </Badge>
                    )}
                    {challenge.isCompleted && !isExceeded && (
                      <Badge className="bg-green-100 text-green-700">
                        <Trophy className="h-3 w-3 mr-1" />
                        Ukończone
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleDeleteChallenge(challenge.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                {challenge.description && (
                  <p className="text-sm text-muted-foreground">{challenge.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    {challenge.challengeType === "WEEKLY_HABIT" ? (
                      <>
                        <span>
                          {challenge.currentValue} / {challenge.targetValue} tygodni
                        </span>
                        <span className={`font-medium ${isExceeded ? "text-purple-600" : ""}`}>
                          {Math.round(progress)}%
                        </span>
                      </>
                    ) : challenge.challengeType === "MONTHLY_GOAL" ? (
                      <>
                        <span>
                          {challenge.currentValue} / {challenge.targetValue} miesięcy
                        </span>
                        <span className={`font-medium ${isExceeded ? "text-purple-600" : ""}`}>
                          {Math.round(progress)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          {challenge.currentValue} / {challenge.targetValue} {challenge.unit}
                        </span>
                        <span className={`font-medium ${isExceeded ? "text-purple-600" : ""}`}>
                          {Math.round(progress)}%
                        </span>
                      </>
                    )}
                  </div>
                  <Progress value={progressCapped} className="h-2" />
                </div>

                {/* Weekly Habit - Day Checkboxes */}
                {challenge.challengeType === "WEEKLY_HABIT" && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Ten tydzień:</div>
                    <div className="flex gap-1 justify-between">
                      {weekDays.map((day) => {
                        const isCompleted = isDayCompleted(challenge, day)
                        const isToday = isSameDay(day, new Date())
                        const isFuture = day > new Date()
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => !isFuture && handleToggleDay(challenge.id, day)}
                            disabled={isFuture}
                            className={`
                              h-8 w-8 rounded-lg flex flex-col items-center justify-center text-[10px] transition-all
                              ${isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:scale-110"}
                              ${isCompleted ? "text-white" : "border border-dashed border-muted-foreground/30"}
                              ${isToday && !isCompleted ? "border-primary border-solid" : ""}
                            `}
                            style={{
                              backgroundColor: isCompleted ? challenge.color : "transparent",
                            }}
                          >
                            <span className="font-medium">
                              {format(day, "EEEEE", { locale: pl })}
                            </span>
                            {isCompleted && <Check className="h-3 w-3" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Monthly Goal - Month Checkboxes */}
                {challenge.challengeType === "MONTHLY_GOAL" && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Miesiące:</div>
                    <div className="flex gap-1 flex-wrap">
                      {months.slice(0, 12).map((month) => {
                        const monthStart = startOfMonth(month)
                        const isCompleted = challenge.entries.some(
                          (e) => getMonth(new Date(e.date)) === getMonth(month) &&
                                 new Date(e.date).getFullYear() === month.getFullYear()
                        )
                        const isCurrentMonth = getMonth(new Date()) === getMonth(month) &&
                                              new Date().getFullYear() === month.getFullYear()
                        const isFuture = monthStart > new Date()
                        return (
                          <button
                            key={month.toISOString()}
                            onClick={() => !isFuture && handleToggleDay(challenge.id, monthStart)}
                            disabled={isFuture}
                            className={`
                              h-7 px-2 rounded flex items-center justify-center text-[10px] transition-all
                              ${isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
                              ${isCompleted ? "text-white" : "border border-dashed border-muted-foreground/30"}
                              ${isCurrentMonth && !isCompleted ? "border-primary border-solid" : ""}
                            `}
                            style={{
                              backgroundColor: isCompleted ? challenge.color : "transparent",
                            }}
                          >
                            {format(month, "MMM", { locale: pl })}
                            {isCompleted && <Check className="h-3 w-3 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(challenge.startDate), "d MMM", { locale: pl })} -{" "}
                    {format(new Date(challenge.endDate), "d MMM yyyy", { locale: pl })}
                  </div>
                  {!challenge.isCompleted && (
                    <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px]">
                      {isOverdue ? `${Math.abs(daysLeft)} dni po terminie` : `${daysLeft} dni`}
                    </Badge>
                  )}
                </div>

                {/* Add progress - only for NUMERIC */}
                {challenge.challengeType === "NUMERIC" && (
                  <div>
                    {addingProgressId === challenge.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder={`Dodaj ${challenge.unit}...`}
                          value={progressValue}
                          onChange={(e) => setProgressValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, () => handleAddProgress(challenge.id))}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleAddProgress(challenge.id)}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setAddingProgressId(null)
                            setProgressValue("")
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setAddingProgressId(challenge.id)}
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Dodaj postęp
                      </Button>
                    )}
                  </div>
                )}

                {/* Recent entries - only for NUMERIC */}
                {challenge.challengeType === "NUMERIC" && challenge.entries.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium mb-1">Ostatnie wpisy:</div>
                    {challenge.entries.slice(0, 3).map((entry) => (
                      <div key={entry.id} className="flex justify-between">
                        <span>{format(new Date(entry.date), "d MMM", { locale: pl })}</span>
                        <span>+{entry.value} {challenge.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty state */}
      {challenges.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Brak wyzwań</p>
          <p className="text-sm">Kliknij "Nowe wyzwanie" aby zacząć</p>
        </div>
      )}
    </div>
  )
}
