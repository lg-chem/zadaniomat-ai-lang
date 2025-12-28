"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Plus, Target, Check, Trash2, Pencil, ChevronDown, ChevronRight, Calendar, Zap } from "lucide-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

interface Period {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  sprints: Sprint[]
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

  // Expanded state for periods and sprints
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set())

  // Edit dialog state
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editForm, setEditForm] = useState({
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
        // Auto-expand active period
        const activePeriod = data.find((p: Period) => p.isActive)
        if (activePeriod) {
          setExpandedPeriods(new Set([activePeriod.id]))
          // Auto-expand current sprint
          const today = new Date()
          const currentSprint = activePeriod.sprints.find((s: Sprint) => {
            const start = new Date(s.startDate)
            const end = new Date(s.endDate)
            return today >= start && today <= end
          })
          if (currentSprint) {
            setExpandedSprints(new Set([currentSprint.id]))
          }
        }
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

  const handleStartEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setEditForm({
      title: goal.title,
      description: goal.description || "",
      targetValue: goal.targetValue?.toString() || "",
      unit: goal.unit || "",
      categoryId: goal.category?.id || "",
      periodId: goal.period?.id || "",
      sprintId: goal.sprint?.id || "",
    })
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGoal) return

    try {
      const res = await fetch(`/api/goals/${editingGoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          targetValue: editForm.targetValue ? parseFloat(editForm.targetValue) : null,
          unit: editForm.unit || null,
          categoryId: editForm.categoryId || null,
          periodId: editForm.periodId || null,
          sprintId: editForm.sprintId || null,
        }),
      })
      if (res.ok) {
        fetchGoals()
        setEditingGoal(null)
      }
    } catch (error) {
      console.error("Error updating goal:", error)
    }
  }

  const togglePeriod = (periodId: string) => {
    const newExpanded = new Set(expandedPeriods)
    if (newExpanded.has(periodId)) {
      newExpanded.delete(periodId)
    } else {
      newExpanded.add(periodId)
    }
    setExpandedPeriods(newExpanded)
  }

  const toggleSprint = (sprintId: string) => {
    const newExpanded = new Set(expandedSprints)
    if (newExpanded.has(sprintId)) {
      newExpanded.delete(sprintId)
    } else {
      newExpanded.add(sprintId)
    }
    setExpandedSprints(newExpanded)
  }

  const getProgress = (goal: Goal) => {
    if (!goal.targetValue) return goal.isCompleted ? 100 : 0
    return Math.min(100, (goal.currentValue / goal.targetValue) * 100)
  }

  // Group goals by category
  const groupGoalsByCategory = (goalsList: Goal[]) => {
    const grouped: Record<string, { name: string; color: string; goals: Goal[] }> = {}
    goalsList.forEach((goal) => {
      const categoryId = goal.category?.id || "none"
      const categoryName = goal.category?.name || "Bez kategorii"
      const categoryColor = goal.category?.color || "#6b7280"
      if (!grouped[categoryId]) {
        grouped[categoryId] = { name: categoryName, color: categoryColor, goals: [] }
      }
      grouped[categoryId].goals.push(goal)
    })
    return grouped
  }

  // Get period goals (goals assigned to period but not to any sprint)
  const getPeriodGoals = (periodId: string) => {
    return goals.filter((g) => g.period?.id === periodId && !g.sprint && !g.isCompleted)
  }

  // Get sprint goals
  const getSprintGoals = (sprintId: string) => {
    return goals.filter((g) => g.sprint?.id === sprintId && !g.isCompleted)
  }

  // Goals without period assignment
  const unassignedGoals = useMemo(() => {
    return goals.filter((g) => !g.period && !g.isCompleted)
  }, [goals])

  const completedGoals = useMemo(() => {
    return goals.filter((g) => g.isCompleted)
  }, [goals])

  // Render a single goal card
  const GoalCard = ({ goal }: { goal: Goal }) => (
    <div
      className={`p-3 rounded-lg border ${
        goal.isCompleted ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className={`font-medium text-sm ${goal.isCompleted ? "line-through text-muted-foreground" : ""}`}>
          {goal.title}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleStartEdit(goal)}
            title="Edytuj"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleToggleComplete(goal)}
            title={goal.isCompleted ? "Przywróć" : "Oznacz jako ukończony"}
          >
            <Check className={`h-3 w-3 ${goal.isCompleted ? "text-green-500" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleDelete(goal.id)}
            title="Usuń"
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
      {goal.description && (
        <p className="text-xs text-muted-foreground mb-2">{goal.description}</p>
      )}
      {goal.targetValue ? (
        <>
          <Progress value={getProgress(goal)} className="h-1.5 mb-1" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
            <span>{Math.round(getProgress(goal))}%</span>
          </div>
        </>
      ) : (
        <Badge variant="secondary" className="text-[10px]">Cel jakościowy</Badge>
      )}
    </div>
  )

  // Render goals grouped by category
  const GoalsByCategory = ({ goalsList }: { goalsList: Goal[] }) => {
    const grouped = groupGoalsByCategory(goalsList)
    if (Object.keys(grouped).length === 0) return null

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([categoryId, { name, color, goals: categoryGoals }]) => (
          <div key={categoryId}>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium">{name}</span>
              <Badge variant="secondary" className="text-[10px]">{categoryGoals.length}</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 pl-5">
              {categoryGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

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

      {/* Periods with nested goals */}
      {periods.map((period) => {
        const periodGoals = getPeriodGoals(period.id)
        const periodGoalsCount = periodGoals.length
        const sprintGoalsCount = period.sprints.reduce(
          (acc, s) => acc + getSprintGoals(s.id).length,
          0
        )
        const totalGoals = periodGoalsCount + sprintGoalsCount

        // Check if period is current
        const today = new Date()
        const isCurrentPeriod = new Date(period.startDate) <= today && today <= new Date(period.endDate)

        return (
          <Card key={period.id} className={isCurrentPeriod ? "border-primary/50" : ""}>
            <Collapsible
              open={expandedPeriods.has(period.id)}
              onOpenChange={() => togglePeriod(period.id)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedPeriods.has(period.id) ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          {period.name}
                          {isCurrentPeriod && (
                            <Badge variant="default" className="text-xs">Aktywny</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(period.startDate), "d MMM yyyy", { locale: pl })} -{" "}
                          {format(new Date(period.endDate), "d MMM yyyy", { locale: pl })}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">{totalGoals} celów</Badge>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Period-level goals (grouped by category) */}
                  {periodGoals.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Cele okresu
                      </h3>
                      <GoalsByCategory goalsList={periodGoals} />
                    </div>
                  )}

                  {/* Sprints within period */}
                  {period.sprints.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Sprinty
                      </h3>
                      {period.sprints.map((sprint) => {
                        const sprintGoals = getSprintGoals(sprint.id)
                        const today = new Date()
                        const isCurrentSprint = new Date(sprint.startDate) <= today && today <= new Date(sprint.endDate)

                        return (
                          <Collapsible
                            key={sprint.id}
                            open={expandedSprints.has(sprint.id)}
                            onOpenChange={() => toggleSprint(sprint.id)}
                          >
                            <div className={`border rounded-lg ${isCurrentSprint ? "border-primary/50 bg-primary/5" : ""}`}>
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-2">
                                    {expandedSprints.has(sprint.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <span className="font-medium">{sprint.name}</span>
                                    {isCurrentSprint && (
                                      <Badge variant="default" className="text-[10px]">Aktywny</Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(sprint.startDate), "d MMM", { locale: pl })} -{" "}
                                      {format(new Date(sprint.endDate), "d MMM", { locale: pl })}
                                    </span>
                                  </div>
                                  <Badge variant="outline">{sprintGoals.length} celów</Badge>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                {sprintGoals.length > 0 ? (
                                  <div className="p-3 pt-0">
                                    <GoalsByCategory goalsList={sprintGoals} />
                                  </div>
                                ) : (
                                  <div className="p-3 pt-0 text-sm text-muted-foreground">
                                    Brak celów przypisanych do tego sprintu
                                  </div>
                                )}
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        )
                      })}
                    </div>
                  )}

                  {periodGoals.length === 0 && period.sprints.every(s => getSprintGoals(s.id).length === 0) && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Brak celów w tym okresie</p>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )
      })}

      {/* Unassigned goals */}
      {unassignedGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cele bez przypisania</CardTitle>
            <CardDescription>Cele nie przypisane do żadnego okresu</CardDescription>
          </CardHeader>
          <CardContent>
            <GoalsByCategory goalsList={unassignedGoals} />
          </CardContent>
        </Card>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">
              Ukończone cele ({completedGoals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {completedGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {goals.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak celów</h3>
            <p className="text-muted-foreground text-center mb-4">
              Stwórz pierwszy cel, aby zacząć śledzić postępy
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Stwórz cel
            </Button>
          </CardContent>
        </Card>
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
                  <Label htmlFor="targetValue">Wartość docelowa</Label>
                  <Input
                    id="targetValue"
                    type="number"
                    placeholder="np. 12"
                    value={newGoal.targetValue}
                    onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Jednostka</Label>
                  <Input
                    id="unit"
                    placeholder="np. książek, km"
                    value={newGoal.unit}
                    onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                  />
                </div>
              </div>

              {/* Category Selection */}
              <div className="space-y-2">
                <Label>Kategoria strategiczna</Label>
                <Select
                  value={newGoal.categoryId || "none"}
                  onValueChange={(value) => setNewGoal({ ...newGoal, categoryId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak kategorii</SelectItem>
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
              </div>

              {/* Period Selection */}
              <div className="space-y-2">
                <Label>Okres</Label>
                <Select
                  value={newGoal.periodId || "none"}
                  onValueChange={(value) =>
                    setNewGoal({ ...newGoal, periodId: value === "none" ? "" : value, sprintId: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz okres..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak okresu</SelectItem>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sprint Selection */}
              {newGoal.periodId && (
                <div className="space-y-2">
                  <Label>Sprint (opcjonalnie)</Label>
                  <Select
                    value={newGoal.sprintId || "none"}
                    onValueChange={(value) => setNewGoal({ ...newGoal, sprintId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz sprint..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Cel okresu (bez sprintu)</SelectItem>
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

      {/* Edit Dialog */}
      <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj cel</DialogTitle>
            <DialogDescription>
              Zmień szczegóły celu
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tytuł celu</Label>
                <Input
                  placeholder="np. Przeczytać 12 książek"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Opis</Label>
                <Input
                  placeholder="Dodatkowe informacje..."
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Wartość docelowa</Label>
                  <Input
                    type="number"
                    placeholder="np. 12"
                    value={editForm.targetValue}
                    onChange={(e) => setEditForm({ ...editForm, targetValue: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jednostka</Label>
                  <Input
                    placeholder="np. książek, km"
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Kategoria strategiczna</Label>
                <Select
                  value={editForm.categoryId || "none"}
                  onValueChange={(value) => setEditForm({ ...editForm, categoryId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak kategorii</SelectItem>
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
              </div>

              {/* Period */}
              <div className="space-y-2">
                <Label>Okres</Label>
                <Select
                  value={editForm.periodId || "none"}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, periodId: value === "none" ? "" : value, sprintId: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz okres..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak okresu</SelectItem>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sprint */}
              {editForm.periodId && (
                <div className="space-y-2">
                  <Label>Sprint</Label>
                  <Select
                    value={editForm.sprintId || "none"}
                    onValueChange={(value) => setEditForm({ ...editForm, sprintId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz sprint..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Cel okresu (bez sprintu)</SelectItem>
                      {periods
                        .find((p) => p.id === editForm.periodId)
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
              <Button type="button" variant="outline" onClick={() => setEditingGoal(null)}>
                Anuluj
              </Button>
              <Button type="submit">Zapisz zmiany</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
