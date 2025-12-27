"use client"

import { useEffect, useState, useCallback } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Trash2,
  Target,
  TrendingUp,
  Calendar,
  Edit,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useWorkspaceStore } from "@/stores/workspace-store"

interface Period {
  id: string
  name: string
  startDate: string
  endDate: string
}

interface FitnessGoal {
  id: string
  name: string
  description?: string | null
  goalType: string
  targetValue: number
  currentValue: number
  unit: string
  startDate: string
  endDate: string
  isCompleted: boolean
  period?: Period | null
}

const GOAL_TYPES = [
  { value: "WEIGHT_LOSS", label: "Utrata wagi", icon: "📉" },
  { value: "WEIGHT_GAIN", label: "Przyrost wagi", icon: "📈" },
  { value: "MUSCLE_GAIN", label: "Przyrost masy mięśniowej", icon: "💪" },
  { value: "CARDIO_IMPROVEMENT", label: "Poprawa cardio", icon: "❤️" },
  { value: "STRENGTH_INCREASE", label: "Zwiększenie siły", icon: "🏋️" },
  { value: "FLEXIBILITY", label: "Elastyczność", icon: "🤸" },
  { value: "ENDURANCE", label: "Wytrzymałość", icon: "🏃" },
  { value: "BODY_FAT_REDUCTION", label: "Redukcja tłuszczu", icon: "🔥" },
  { value: "CUSTOM", label: "Własny cel", icon: "🎯" },
]

export default function FitnessGoalsPage() {
  const { workspace } = useWorkspaceStore()
  const [goals, setGoals] = useState<FitnessGoal[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Add/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<FitnessGoal | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    goalType: "WEIGHT_LOSS",
    targetValue: "",
    currentValue: "",
    unit: "kg",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    periodId: "",
  })

  // Update progress
  const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null)
  const [updateValue, setUpdateValue] = useState("")

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch(`/api/fitness-goals?workspaceType=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        setGoals(data)
      }
    } catch (error) {
      console.error("Error fetching goals:", error)
    } finally {
      setIsLoading(false)
    }
  }, [workspace])

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch(`/api/periods?workspace=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        setPeriods(data)
      }
    } catch (error) {
      console.error("Error fetching periods:", error)
    }
  }, [workspace])

  useEffect(() => {
    fetchGoals()
    fetchPeriods()
  }, [fetchGoals, fetchPeriods])

  const handleCreateGoal = async () => {
    if (!formData.name || !formData.targetValue) return

    try {
      const res = await fetch("/api/fitness-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          targetValue: parseFloat(formData.targetValue),
          currentValue: formData.currentValue ? parseFloat(formData.currentValue) : 0,
          workspaceType: workspace,
          periodId: formData.periodId || null,
        }),
      })

      if (res.ok) {
        fetchGoals()
        resetForm()
        setIsDialogOpen(false)
      }
    } catch (error) {
      console.error("Error creating goal:", error)
    }
  }

  const handleUpdateProgress = async (goalId: string, newValue: number) => {
    try {
      await fetch(`/api/fitness-goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentValue: newValue }),
      })
      fetchGoals()
      setUpdatingGoalId(null)
      setUpdateValue("")
    } catch (error) {
      console.error("Error updating goal:", error)
    }
  }

  const handleToggleComplete = async (goal: FitnessGoal) => {
    try {
      await fetch(`/api/fitness-goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !goal.isCompleted }),
      })
      fetchGoals()
    } catch (error) {
      console.error("Error toggling goal:", error)
    }
  }

  const handleDeleteGoal = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten cel?")) return

    try {
      await fetch(`/api/fitness-goals/${id}`, { method: "DELETE" })
      fetchGoals()
    } catch (error) {
      console.error("Error deleting goal:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      goalType: "WEIGHT_LOSS",
      targetValue: "",
      currentValue: "",
      unit: "kg",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      periodId: "",
    })
    setEditingGoal(null)
  }

  const getGoalTypeInfo = (type: string) => {
    return GOAL_TYPES.find((t) => t.value === type) || GOAL_TYPES[0]
  }

  const calculateProgress = (current: number, target: number) => {
    return Math.min(100, Math.max(0, (current / target) * 100))
  }

  // Separate active and completed goals
  const activeGoals = goals.filter((g) => !g.isCompleted)
  const completedGoals = goals.filter((g) => g.isCompleted)

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
          <h1 className="text-3xl font-bold">Cele fitness</h1>
          <p className="text-muted-foreground">
            Zarządzaj swoimi celami treningowymi i śledź postępy
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj cel
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aktywne cele</p>
                <p className="text-2xl font-bold">{activeGoals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ukończone</p>
                <p className="text-2xl font-bold">{completedGoals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Średni postęp</p>
                <p className="text-2xl font-bold">
                  {activeGoals.length > 0
                    ? Math.round(
                        activeGoals.reduce(
                          (sum, g) => sum + calculateProgress(g.currentValue, g.targetValue),
                          0
                        ) / activeGoals.length
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Aktywne cele</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map((goal) => {
              const typeInfo = getGoalTypeInfo(goal.goalType)
              const progress = calculateProgress(goal.currentValue, goal.targetValue)

              return (
                <Card key={goal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{typeInfo.icon}</span>
                        <div>
                          <CardTitle className="text-lg">{goal.name}</CardTitle>
                          <CardDescription>{typeInfo.label}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleComplete(goal)}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {goal.description && (
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    )}

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Postęp</span>
                        <span className="font-medium">
                          {goal.currentValue} / {goal.targetValue} {goal.unit}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="text-right text-xs text-muted-foreground">
                        {Math.round(progress)}%
                      </div>
                    </div>

                    {/* Update progress */}
                    <div className="pt-2 border-t">
                      {updatingGoalId === goal.id ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={updateValue}
                            onChange={(e) => setUpdateValue(e.target.value)}
                            placeholder={`Nowa wartość (${goal.unit})`}
                            className="h-9"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              handleUpdateProgress(goal.id, parseFloat(updateValue))
                            }
                            disabled={!updateValue}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setUpdatingGoalId(null)
                              setUpdateValue("")
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setUpdatingGoalId(goal.id)
                            setUpdateValue(goal.currentValue.toString())
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Aktualizuj postęp
                        </Button>
                      )}
                    </div>

                    {/* Dates & Period */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(goal.startDate), "d MMM", { locale: pl })} -{" "}
                        {format(new Date(goal.endDate), "d MMM yyyy", { locale: pl })}
                      </div>
                      {goal.period && (
                        <Badge variant="secondary" className="text-[10px]">
                          {goal.period.name}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Ukończone cele</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedGoals.map((goal) => {
              const typeInfo = getGoalTypeInfo(goal.goalType)

              return (
                <Card key={goal.id} className="opacity-75">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{typeInfo.icon}</span>
                        <div>
                          <CardTitle className="text-lg line-through">{goal.name}</CardTitle>
                          <CardDescription>{typeInfo.label}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Ukończony
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Osiągnięto: {goal.currentValue} {goal.unit} / {goal.targetValue} {goal.unit}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleComplete(goal)}
                      >
                        Przywróć
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteGoal(goal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {goals.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Brak celów fitness</h3>
            <p className="text-muted-foreground text-center mb-4">
              Zacznij śledź swoje postępy dodając pierwszy cel treningowy
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj pierwszy cel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? "Edytuj cel" : "Dodaj nowy cel fitness"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nazwa celu</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="np. Schudnąć 5kg"
                />
              </div>

              <div className="col-span-2">
                <Label>Opis (opcjonalny)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Dodatkowe informacje o celu..."
                  rows={2}
                />
              </div>

              <div className="col-span-2">
                <Label>Typ celu</Label>
                <Select
                  value={formData.goalType}
                  onValueChange={(v) => setFormData({ ...formData, goalType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <span>{type.icon}</span>
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Wartość docelowa</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                  placeholder="np. 75"
                />
              </div>

              <div>
                <Label>Jednostka</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="np. kg, cm, reps"
                />
              </div>

              <div>
                <Label>Wartość początkowa</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.currentValue}
                  onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                  placeholder="np. 80 (opcjonalne)"
                />
              </div>

              <div>
                <Label>Okres (opcjonalny)</Label>
                <Select
                  value={formData.periodId}
                  onValueChange={(v) => setFormData({ ...formData, periodId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz okres..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Brak</SelectItem>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data rozpoczęcia</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Data zakończenia</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <Button onClick={handleCreateGoal} className="w-full">
              {editingGoal ? "Zapisz zmiany" : "Dodaj cel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
