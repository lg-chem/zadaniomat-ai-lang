"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Target, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useWorkspaceStore } from "@/stores/workspace-store"

interface Goal {
  id: string
  title: string
  description?: string | null
  targetValue?: number | null
  currentValue: number
  unit?: string | null
  isCompleted: boolean
  category?: { id: string; name: string; color: string } | null
  period?: { id: string; name: string } | null
  sprint?: { id: string; name: string } | null
  _count: { tasks: number }
}

interface Category {
  id: string
  name: string
  color: string
  isStrategic: boolean
}

interface Period {
  id: string
  name: string
  sprints: Sprint[]
}

interface Sprint {
  id: string
  name: string
}

export default function GoalsPage() {
  const { workspace } = useWorkspaceStore()
  const [goals, setGoals] = useState<Goal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    targetValue: "",
    unit: "",
    categoryId: "",
    periodId: "",
    sprintId: "",
  })

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch(`/api/goals?workspace=${workspace}`)
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

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/categories?workspace=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
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
    fetchCategories()
    fetchPeriods()
  }, [fetchGoals, fetchCategories, fetchPeriods])

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newGoal.title,
          description: newGoal.description || undefined,
          targetValue: newGoal.targetValue || undefined,
          unit: newGoal.unit || undefined,
          categoryId: newGoal.categoryId || undefined,
          periodId: newGoal.periodId || undefined,
          sprintId: newGoal.sprintId || undefined,
          workspaceType: workspace,
        }),
      })
      if (res.ok) {
        fetchGoals()
        setShowCreate(false)
        setNewGoal({
          title: "",
          description: "",
          targetValue: "",
          unit: "",
          categoryId: "",
          periodId: "",
          sprintId: "",
        })
      }
    } catch (error) {
      console.error("Error creating goal:", error)
    }
  }

  const handleToggleComplete = async (goal: Goal) => {
    try {
      await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !goal.isCompleted }),
      })
      fetchGoals()
    } catch (error) {
      console.error("Error updating goal:", error)
    }
  }

  const handleUpdateProgress = async (goal: Goal, value: number) => {
    try {
      await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentValue: value }),
      })
      fetchGoals()
    } catch (error) {
      console.error("Error updating goal:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten cel?")) return
    try {
      await fetch(`/api/goals/${id}`, { method: "DELETE" })
      fetchGoals()
    } catch (error) {
      console.error("Error deleting goal:", error)
    }
  }

  const getProgress = (goal: Goal) => {
    if (!goal.targetValue) return goal.isCompleted ? 100 : 0
    return Math.min(100, (goal.currentValue / goal.targetValue) * 100)
  }

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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Cele</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Zarządzaj celami okresowymi i sprintowymi
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nowy cel
        </Button>
      </div>

      {/* Active Goals */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Aktywne cele ({activeGoals.length})</h2>
        {activeGoals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Brak aktywnych celów</h3>
              <p className="text-muted-foreground text-center mb-4">
                Stwórz pierwszy cel, aby zacząć śledzić postępy
              </p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Stwórz cel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            {activeGoals.map((goal) => (
              <Card key={goal.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{goal.title}</CardTitle>
                      {goal.description && (
                        <CardDescription className="mt-1">
                          {goal.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleComplete(goal)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(goal.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {goal.targetValue ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>
                            {goal.currentValue} / {goal.targetValue} {goal.unit}
                          </span>
                          <span>{Math.round(getProgress(goal))}%</span>
                        </div>
                        <Progress value={getProgress(goal)} />
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Aktualizuj postęp"
                            className="h-8"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleUpdateProgress(goal, parseFloat((e.target as HTMLInputElement).value))
                                ;(e.target as HTMLInputElement).value = ""
                              }
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Cel jakościowy</Badge>
                        {goal._count.tasks > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {goal._count.tasks} powiązanych zadań
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {goal.category && (
                        <Badge
                          variant="outline"
                          style={{ borderColor: goal.category.color, color: goal.category.color }}
                        >
                          {goal.category.name}
                        </Badge>
                      )}
                      {goal.period && (
                        <Badge variant="secondary">{goal.period.name}</Badge>
                      )}
                      {goal.sprint && (
                        <Badge variant="outline">{goal.sprint.name}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Ukończone cele ({completedGoals.length})</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {completedGoals.map((goal) => (
              <Card key={goal.id} className="opacity-60">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-through">{goal.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleComplete(goal)}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={100} className="bg-green-100" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowy cel</DialogTitle>
            <DialogDescription>
              Dodaj nowy cel do śledzenia
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGoal}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="goalTitle">Tytuł celu</Label>
                <Input
                  id="goalTitle"
                  placeholder="np. Przeczytać 12 książek"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalDesc">Opis (opcjonalnie)</Label>
                <Input
                  id="goalDesc"
                  placeholder="Dodatkowe informacje..."
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetValue">Wartość docelowa (opcjonalnie)</Label>
                  <Input
                    id="targetValue"
                    type="number"
                    placeholder="np. 12"
                    value={newGoal.targetValue}
                    onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Jednostka (opcjonalnie)</Label>
                  <Input
                    id="unit"
                    placeholder="np. książek, km, godzin"
                    value={newGoal.unit}
                    onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                  />
                </div>
              </div>

              {/* Category Selection - only strategic categories */}
              <div className="space-y-2">
                <Label>Kategoria strategiczna (opcjonalnie)</Label>
                <Select
                  value={newGoal.categoryId}
                  onValueChange={(value) => setNewGoal({ ...newGoal, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((c) => c.isStrategic)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {categories.filter((c) => c.isStrategic).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Brak kategorii strategicznych. Dodaj je w Ustawieniach.
                  </p>
                )}
              </div>

              {/* Period Selection */}
              <div className="space-y-2">
                <Label>Okres (opcjonalnie)</Label>
                <Select
                  value={newGoal.periodId}
                  onValueChange={(value) =>
                    setNewGoal({ ...newGoal, periodId: value, sprintId: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz okres..." />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sprint Selection - only if period is selected */}
              {newGoal.periodId && (
                <div className="space-y-2">
                  <Label>Sprint (opcjonalnie)</Label>
                  <Select
                    value={newGoal.sprintId}
                    onValueChange={(value) => setNewGoal({ ...newGoal, sprintId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz sprint..." />
                    </SelectTrigger>
                    <SelectContent>
                      {periods
                        .find((p) => p.id === newGoal.periodId)
                        ?.sprints.map((sprint) => (
                          <SelectItem key={sprint.id} value={sprint.id}>
                            {sprint.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Anuluj
              </Button>
              <Button type="submit">Stwórz cel</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
