"use client"

import { useState, KeyboardEvent } from "react"
import { toast } from "sonner"
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
  Edit2,
  Copy,
  MoreHorizontal,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import useSWR from "swr"

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
  isPublic?: boolean
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
  const [showCompleted, setShowCompleted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Use SWR for data fetching with cache
  const { data: challenges = [], isLoading, mutate: mutateChallenges } = useSWR<Challenge[]>(
    `/api/challenges?showCompleted=${showCompleted}`
  )

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
    isPublic: true,
  })

  // Add progress
  const [addingProgressId, setAddingProgressId] = useState<string | null>(null)
  const [progressValue, setProgressValue] = useState("")

  // Edit challenge
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    targetValue: "",
    unit: "",
    weeklyTarget: "",
    color: COLORS[0],
    isPublic: true,
  })

  // Copy challenge
  const [copyingChallenge, setCopyingChallenge] = useState<Challenge | null>(null)
  const [copyForm, setCopyForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    targetValue: "",
  })

  // Edit entry
  const [editingEntry, setEditingEntry] = useState<{ challengeId: string; entry: ChallengeEntry } | null>(null)
  const [editEntryValue, setEditEntryValue] = useState("")

  const handleCreateChallenge = async () => {
    if (!newChallenge.name || !newChallenge.endDate) {
      return
    }

    // For weekly habits, weeklyTarget is required
    if (newChallenge.challengeType === "WEEKLY_HABIT" && !newChallenge.weeklyTarget) {
      return
    }

    // Auto-calculate target for weekly/monthly if dates are set
    let targetValue = newChallenge.targetValue
    if (newChallenge.challengeType === "WEEKLY_HABIT" && newChallenge.startDate && newChallenge.endDate && !newChallenge.targetValue) {
      targetValue = Math.ceil(differenceInDays(new Date(newChallenge.endDate), new Date(newChallenge.startDate)) / 7).toString()
    }
    if (newChallenge.challengeType === "MONTHLY_GOAL" && newChallenge.startDate && newChallenge.endDate && !newChallenge.targetValue) {
      const start = new Date(newChallenge.startDate)
      const end = new Date(newChallenge.endDate)
      targetValue = ((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1).toString()
    }

    if (!targetValue && newChallenge.challengeType === "NUMERIC") {
      return
    }
    if (!newChallenge.unit && newChallenge.challengeType === "NUMERIC") {
      return
    }

    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newChallenge, targetValue }),
      })
      if (res.ok) {
        mutateChallenges()
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
          isPublic: true,
        })
        setIsDialogOpen(false)
        toast.success("Wyzwanie utworzone")
      } else {
        toast.error("Nie udało się utworzyć wyzwania")
      }
    } catch (error) {
      console.error("Error creating challenge:", error)
      toast.error("Błąd podczas tworzenia wyzwania")
    }
  }

  const handleAddProgress = async (challengeId: string) => {
    if (!progressValue) return

    try {
      const res = await fetch(`/api/challenges/${challengeId}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: progressValue }),
      })
      if (res.ok) {
        mutateChallenges()
        setAddingProgressId(null)
        setProgressValue("")
        toast.success("Postęp dodany")
      } else {
        toast.error("Nie udało się dodać postępu")
      }
    } catch (error) {
      console.error("Error adding progress:", error)
      toast.error("Błąd podczas dodawania postępu")
    }
  }

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to wyzwanie?")) return
    try {
      const res = await fetch(`/api/challenges/${id}`, { method: "DELETE" })
      if (res.ok) {
        mutateChallenges()
        toast.success("Wyzwanie usunięte")
      } else {
        toast.error("Nie udało się usunąć wyzwania")
      }
    } catch (error) {
      console.error("Error deleting challenge:", error)
      toast.error("Błąd podczas usuwania wyzwania")
    }
  }

  const handleToggleDay = async (challengeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    try {
      const res = await fetch(`/api/challenges/${challengeId}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 1, date: dateStr, toggle: true }),
      })
      if (res.ok) {
        mutateChallenges()
      } else {
        toast.error("Nie udało się zaktualizować dnia")
      }
    } catch (error) {
      console.error("Error toggling day:", error)
      toast.error("Błąd podczas aktualizacji")
    }
  }

  const handleStartEdit = (challenge: Challenge) => {
    setEditingChallenge(challenge)
    setEditForm({
      name: challenge.name,
      description: challenge.description || "",
      startDate: format(new Date(challenge.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(challenge.endDate), "yyyy-MM-dd"),
      targetValue: challenge.targetValue.toString(),
      unit: challenge.unit,
      weeklyTarget: challenge.weeklyTarget?.toString() || "",
      color: challenge.color,
      isPublic: challenge.isPublic ?? true,
    })
  }

  const handleUpdateChallenge = async () => {
    if (!editingChallenge) return
    try {
      const res = await fetch(`/api/challenges/${editingChallenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        mutateChallenges()
        setEditingChallenge(null)
        toast.success("Wyzwanie zaktualizowane")
      } else {
        toast.error("Nie udało się zaktualizować wyzwania")
      }
    } catch (error) {
      console.error("Error updating challenge:", error)
      toast.error("Błąd podczas aktualizacji wyzwania")
    }
  }

  const handleStartCopy = (challenge: Challenge) => {
    setCopyingChallenge(challenge)
    setCopyForm({
      name: challenge.name,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      targetValue: challenge.targetValue.toString(),
    })
  }

  const handleCopyChallenge = async () => {
    if (!copyingChallenge) return
    try {
      const res = await fetch(`/api/challenges/${copyingChallenge.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copyForm),
      })
      if (res.ok) {
        mutateChallenges()
        setCopyingChallenge(null)
        toast.success("Kopia wyzwania utworzona")
      } else {
        toast.error("Nie udało się skopiować wyzwania")
      }
    } catch (error) {
      console.error("Error copying challenge:", error)
      toast.error("Błąd podczas kopiowania wyzwania")
    }
  }

  const handleStartEditEntry = (challengeId: string, entry: ChallengeEntry) => {
    setEditingEntry({ challengeId, entry })
    setEditEntryValue(entry.value.toString())
  }

  const handleUpdateEntry = async () => {
    if (!editingEntry) return
    try {
      const res = await fetch(`/api/challenges/${editingEntry.challengeId}/entry`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: editingEntry.entry.id, value: editEntryValue }),
      })
      if (res.ok) {
        mutateChallenges()
        setEditingEntry(null)
        setEditEntryValue("")
        toast.success("Wpis zaktualizowany")
      } else {
        toast.error("Nie udało się zaktualizować wpisu")
      }
    } catch (error) {
      console.error("Error updating entry:", error)
      toast.error("Błąd podczas aktualizacji wpisu")
    }
  }

  const handleDeleteEntry = async (challengeId: string, entryId: string) => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/entry?entryId=${entryId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        mutateChallenges()
        toast.success("Wpis usunięty")
      } else {
        toast.error("Nie udało się usunąć wpisu")
      }
    } catch (error) {
      console.error("Error deleting entry:", error)
      toast.error("Błąd podczas usuwania wpisu")
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
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-1/2" />
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
          <h1 className="text-2xl md:text-3xl font-bold">Wyzwania</h1>
          <p className="text-sm md:text-base text-muted-foreground">
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
              <Button className="w-full sm:w-auto">
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
                  <div className="space-y-4">
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
                    {/* Show target weeks only if dates not fully set */}
                    {!(newChallenge.startDate && newChallenge.endDate) && (
                      <div>
                        <Label>Cel (liczba tygodni)</Label>
                        <Input
                          type="number"
                          value={newChallenge.targetValue}
                          onChange={(e) => setNewChallenge({ ...newChallenge, targetValue: e.target.value })}
                          placeholder="np. 12"
                        />
                      </div>
                    )}
                    {newChallenge.startDate && newChallenge.endDate && (
                      <p className="text-xs text-muted-foreground">
                        Cel zostanie obliczony automatycznie na podstawie dat ({Math.ceil(differenceInDays(new Date(newChallenge.endDate), new Date(newChallenge.startDate)) / 7)} tygodni)
                      </p>
                    )}
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

                {/* Public toggle */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Udostępnij znajomym</span>
                  </div>
                  <Switch
                    checked={newChallenge.isPublic}
                    onCheckedChange={(checked) => setNewChallenge({ ...newChallenge, isPublic: checked })}
                  />
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
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
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
                    <CardTitle className="text-sm md:text-base">{challenge.name}</CardTitle>
                    {challenge.isPublic && (
                      <Users className="h-3.5 w-3.5 text-primary" />
                    )}
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
                  <div className="flex items-center gap-1">
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEdit(challenge)}>
                          <Edit2 className="h-3.5 w-3.5 mr-2" />
                          Edytuj
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStartCopy(challenge)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Kopiuj
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteChallenge(challenge.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Usuń
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                    {challenge.entries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="flex justify-between items-center group">
                        <span>{format(new Date(entry.date), "d MMM", { locale: pl })}</span>
                        <div className="flex items-center gap-1">
                          <span>+{entry.value} {challenge.unit}</span>
                          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                            <button
                              onClick={() => handleStartEditEntry(challenge.id, entry)}
                              className="p-0.5 hover:bg-muted rounded"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(challenge.id, entry.id)}
                              className="p-0.5 hover:bg-muted rounded text-destructive"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
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

      {/* Edit Challenge Dialog */}
      <Dialog open={!!editingChallenge} onOpenChange={(open) => !open && setEditingChallenge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj wyzwanie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Opis</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data rozpoczęcia</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Data zakończenia</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cel</Label>
                <Input
                  type="number"
                  value={editForm.targetValue}
                  onChange={(e) => setEditForm({ ...editForm, targetValue: e.target.value })}
                />
              </div>
              {editingChallenge?.challengeType === "NUMERIC" && (
                <div>
                  <Label>Jednostka</Label>
                  <Input
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  />
                </div>
              )}
              {editingChallenge?.challengeType === "WEEKLY_HABIT" && (
                <div>
                  <Label>Razy w tygodniu</Label>
                  <Input
                    type="number"
                    min="1"
                    max="7"
                    value={editForm.weeklyTarget}
                    onChange={(e) => setEditForm({ ...editForm, weeklyTarget: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Kolor</Label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      editForm.color === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditForm({ ...editForm, color })}
                  />
                ))}
              </div>
            </div>

            {/* Public toggle */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Udostępnij znajomym</span>
              </div>
              <Switch
                checked={editForm.isPublic}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isPublic: checked })}
              />
            </div>

            <Button onClick={handleUpdateChallenge} className="w-full">
              Zapisz zmiany
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Challenge Dialog */}
      <Dialog open={!!copyingChallenge} onOpenChange={(open) => !open && setCopyingChallenge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kopiuj wyzwanie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Tworzysz kopię wyzwania "{copyingChallenge?.name}". Możesz zmienić daty i cel.
            </p>
            <div>
              <Label>Nazwa (opcjonalnie)</Label>
              <Input
                value={copyForm.name}
                onChange={(e) => setCopyForm({ ...copyForm, name: e.target.value })}
                placeholder={copyingChallenge?.name}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data rozpoczęcia</Label>
                <Input
                  type="date"
                  value={copyForm.startDate}
                  onChange={(e) => setCopyForm({ ...copyForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Data zakończenia</Label>
                <Input
                  type="date"
                  value={copyForm.endDate}
                  onChange={(e) => setCopyForm({ ...copyForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Cel (opcjonalnie)</Label>
              <Input
                type="number"
                value={copyForm.targetValue}
                onChange={(e) => setCopyForm({ ...copyForm, targetValue: e.target.value })}
                placeholder={copyingChallenge?.targetValue.toString()}
              />
            </div>
            <Button onClick={handleCopyChallenge} className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Utwórz kopię
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edytuj wpis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Data</Label>
              <p className="text-sm text-muted-foreground">
                {editingEntry && format(new Date(editingEntry.entry.date), "d MMMM yyyy", { locale: pl })}
              </p>
            </div>
            <div>
              <Label>Wartość</Label>
              <Input
                type="number"
                value={editEntryValue}
                onChange={(e) => setEditEntryValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleUpdateEntry)}
              />
            </div>
            <Button onClick={handleUpdateEntry} className="w-full">
              Zapisz
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
