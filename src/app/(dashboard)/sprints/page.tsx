"use client"

import { useEffect, useState, useCallback } from "react"
import { format, differenceInDays } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Calendar,
  Target,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  Star,
} from "lucide-react"
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
import { CreatePeriodDialog } from "@/components/periods/create-period-dialog"
import { CreateSprintDialog } from "@/components/sprints/create-sprint-dialog"

interface Goal {
  id: string
  title: string
  description?: string | null
  targetValue?: number | null
  currentValue: number
  unit?: string | null
  isCompleted: boolean
  categoryId?: string | null
  category?: { id: string; name: string; color: string } | null
}

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  goals: Goal[]
  _count: { tasks: number; goals: number }
}

interface Period {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  sprints: Sprint[]
  goals: Goal[]
  _count: { sprints: number; goals: number }
}

interface Category {
  id: string
  name: string
  color: string
  isStrategic: boolean
}

export default function SprintsPage() {
  const { workspace } = useWorkspaceStore()
  const [periods, setPeriods] = useState<Period[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [showCreatePeriod, setShowCreatePeriod] = useState(false)
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)

  // Goal creation state
  const [showCreateGoal, setShowCreateGoal] = useState(false)
  const [goalContext, setGoalContext] = useState<{
    type: "period" | "sprint"
    periodId?: string
    sprintId?: string
  } | null>(null)
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    targetValue: "",
    unit: "",
    categoryId: "",
  })

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch(`/api/periods?workspace=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        setPeriods(data)
        // Auto-expand active periods
        const activePeriodIds = data
          .filter((p: Period) => p.isActive)
          .map((p: Period) => p.id)
        setExpandedPeriods(new Set(activePeriodIds))
      }
    } catch (error) {
      console.error("Error fetching periods:", error)
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

  useEffect(() => {
    fetchPeriods()
    fetchCategories()
  }, [fetchPeriods, fetchCategories])

  const togglePeriod = (id: string) => {
    setExpandedPeriods((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSprint = (id: string) => {
    setExpandedSprints((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDeletePeriod = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten okres? Wszystkie sprinty zostaną usunięte.")) {
      return
    }
    try {
      const res = await fetch(`/api/periods/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchPeriods()
      }
    } catch (error) {
      console.error("Error deleting period:", error)
    }
  }

  const handleDeleteSprint = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten sprint?")) {
      return
    }
    try {
      const res = await fetch(`/api/sprints/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchPeriods()
      }
    } catch (error) {
      console.error("Error deleting sprint:", error)
    }
  }

  const handleDeleteGoal = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten cel?")) return
    try {
      await fetch(`/api/goals/${id}`, { method: "DELETE" })
      fetchPeriods()
    } catch (error) {
      console.error("Error deleting goal:", error)
    }
  }

  const handleToggleGoalComplete = async (goal: Goal) => {
    try {
      await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !goal.isCompleted }),
      })
      fetchPeriods()
    } catch (error) {
      console.error("Error updating goal:", error)
    }
  }

  const openCreateGoal = (type: "period" | "sprint", periodId?: string, sprintId?: string) => {
    setGoalContext({ type, periodId, sprintId })
    setNewGoal({ title: "", description: "", targetValue: "", unit: "", categoryId: "" })
    setShowCreateGoal(true)
  }

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goalContext) return

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
          periodId: goalContext.type === "period" ? goalContext.periodId : undefined,
          sprintId: goalContext.type === "sprint" ? goalContext.sprintId : undefined,
          workspaceType: workspace,
        }),
      })
      if (res.ok) {
        fetchPeriods()
        setShowCreateGoal(false)
        setGoalContext(null)
      }
    } catch (error) {
      console.error("Error creating goal:", error)
    }
  }

  const getSprintStatus = (sprint: Sprint) => {
    const now = new Date()
    const start = new Date(sprint.startDate)
    const end = new Date(sprint.endDate)

    if (now < start) return { label: "Zaplanowany", color: "secondary" as const }
    if (now > end) return { label: "Zakończony", color: "outline" as const }
    return { label: "Aktywny", color: "default" as const }
  }

  const getProgress = (startDate: string, endDate: string) => {
    const now = new Date()
    const start = new Date(startDate)
    const end = new Date(endDate)
    const total = differenceInDays(end, start)
    const elapsed = differenceInDays(now, start)
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }

  const getGoalProgress = (goal: Goal) => {
    if (!goal.targetValue) return goal.isCompleted ? 100 : 0
    return Math.min(100, (goal.currentValue / goal.targetValue) * 100)
  }

  const openCreateSprint = (periodId: string) => {
    setSelectedPeriodId(periodId)
    setShowCreateSprint(true)
  }

  const strategicCategories = categories.filter((c) => c.isStrategic)

  // Group goals by category
  const groupGoalsByCategory = (goals: Goal[]) => {
    const grouped: Record<string, Goal[]> = {}
    const uncategorized: Goal[] = []

    goals.forEach((goal) => {
      if (goal.categoryId && goal.category) {
        if (!grouped[goal.categoryId]) {
          grouped[goal.categoryId] = []
        }
        grouped[goal.categoryId].push(goal)
      } else {
        uncategorized.push(goal)
      }
    })

    return { grouped, uncategorized }
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
          <h1 className="text-2xl md:text-3xl font-bold">Okresy i Sprinty</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Zarządzaj okresami, sprintami i celami
          </p>
        </div>
        <Button onClick={() => setShowCreatePeriod(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nowy okres
        </Button>
      </div>

      {/* Strategic Categories Info */}
      {strategicCategories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-4 py-4">
            <Star className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Brak kategorii strategicznych</p>
              <p className="text-sm text-muted-foreground">
                Dodaj kategorie strategiczne w Ustawieniach, aby móc przypisywać cele do kategorii
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Periods List */}
      {periods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak okresów</h3>
            <p className="text-muted-foreground text-center mb-4">
              Stwórz pierwszy okres, aby zacząć planować sprinty i cele
            </p>
            <Button onClick={() => setShowCreatePeriod(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Stwórz okres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 md:space-y-4">
          {periods.map((period) => {
            const { grouped: periodGoalsByCategory, uncategorized: periodUncategorizedGoals } =
              groupGoalsByCategory(period.goals)

            return (
              <Card key={period.id}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => togglePeriod(period.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedPeriods.has(period.id) ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                      <div>
                        <CardTitle className="text-lg md:text-xl">{period.name}</CardTitle>
                        <CardDescription>
                          {format(new Date(period.startDate), "d MMM yyyy", { locale: pl })}
                          {" - "}
                          {format(new Date(period.endDate), "d MMM yyyy", { locale: pl })}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <div className="font-medium">{period._count.sprints} sprintów</div>
                        <div className="text-muted-foreground">{period._count.goals} celów</div>
                      </div>
                      <Progress value={getProgress(period.startDate, period.endDate)} className="w-24" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePeriod(period.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedPeriods.has(period.id) && (
                  <CardContent className="pt-0 space-y-6">
                    {/* Period Goals by Strategic Categories */}
                    <div className="ml-8 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Cele okresowe
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCreateGoal("period", period.id)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Dodaj cel
                        </Button>
                      </div>

                      {period.goals.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-2">
                          Brak celów dla tego okresu
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {/* Goals grouped by category */}
                          {strategicCategories.map((category) => {
                            const categoryGoals = periodGoalsByCategory[category.id] || []
                            if (categoryGoals.length === 0) return null

                            return (
                              <div key={category.id} className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: category.color }}
                                  />
                                  <span className="font-medium text-sm">{category.name}</span>
                                </div>
                                <div className="space-y-2 ml-5">
                                  {categoryGoals.map((goal) => (
                                    <GoalItem
                                      key={goal.id}
                                      goal={goal}
                                      onToggle={() => handleToggleGoalComplete(goal)}
                                      onDelete={() => handleDeleteGoal(goal.id)}
                                      getProgress={getGoalProgress}
                                    />
                                  ))}
                                </div>
                              </div>
                            )
                          })}

                          {/* Uncategorized goals */}
                          {periodUncategorizedGoals.length > 0 && (
                            <div className="space-y-2">
                              <span className="font-medium text-sm text-muted-foreground">
                                Bez kategorii
                              </span>
                              <div className="space-y-2 ml-5">
                                {periodUncategorizedGoals.map((goal) => (
                                  <GoalItem
                                    key={goal.id}
                                    goal={goal}
                                    onToggle={() => handleToggleGoalComplete(goal)}
                                    onDelete={() => handleDeleteGoal(goal.id)}
                                    getProgress={getGoalProgress}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sprints */}
                    <div className="ml-8 space-y-3">
                      <h3 className="text-base md:text-lg font-semibold">Sprinty</h3>

                      {period.sprints.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-2">
                          Brak sprintów w tym okresie
                        </p>
                      ) : (
                        period.sprints.map((sprint) => {
                          const status = getSprintStatus(sprint)
                          const { grouped: sprintGoalsByCategory, uncategorized: sprintUncategorizedGoals } =
                            groupGoalsByCategory(sprint.goals)

                          return (
                            <div key={sprint.id} className="rounded-lg border bg-card">
                              <div
                                className="flex items-center justify-between p-4 cursor-pointer"
                                onClick={() => toggleSprint(sprint.id)}
                              >
                                <div className="flex items-center gap-3">
                                  {expandedSprints.has(sprint.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{sprint.name}</span>
                                      <Badge variant={status.color}>{status.label}</Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {format(new Date(sprint.startDate), "d MMM", { locale: pl })}
                                      {" - "}
                                      {format(new Date(sprint.endDate), "d MMM yyyy", { locale: pl })}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right text-sm">
                                    <div>{sprint._count.tasks} zadań</div>
                                    <div className="text-muted-foreground">{sprint._count.goals} celów</div>
                                  </div>
                                  <Progress
                                    value={getProgress(sprint.startDate, sprint.endDate)}
                                    className="w-20"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteSprint(sprint.id)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>

                              {/* Sprint Goals */}
                              {expandedSprints.has(sprint.id) && (
                                <div className="px-4 pb-4 pt-0 ml-7 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Cele sprintu
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openCreateGoal("sprint", period.id, sprint.id)}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Cel
                                    </Button>
                                  </div>

                                  {sprint.goals.length === 0 ? (
                                    <p className="text-muted-foreground text-xs py-1">
                                      Brak celów dla tego sprintu
                                    </p>
                                  ) : (
                                    <div className="space-y-3">
                                      {strategicCategories.map((category) => {
                                        const categoryGoals = sprintGoalsByCategory[category.id] || []
                                        if (categoryGoals.length === 0) return null

                                        return (
                                          <div key={category.id} className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <div
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: category.color }}
                                              />
                                              <span className="text-xs font-medium">{category.name}</span>
                                            </div>
                                            <div className="space-y-1 ml-4">
                                              {categoryGoals.map((goal) => (
                                                <GoalItem
                                                  key={goal.id}
                                                  goal={goal}
                                                  onToggle={() => handleToggleGoalComplete(goal)}
                                                  onDelete={() => handleDeleteGoal(goal.id)}
                                                  getProgress={getGoalProgress}
                                                  compact
                                                />
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      })}

                                      {sprintUncategorizedGoals.length > 0 && (
                                        <div className="space-y-1">
                                          <span className="text-xs font-medium text-muted-foreground">
                                            Bez kategorii
                                          </span>
                                          <div className="space-y-1 ml-4">
                                            {sprintUncategorizedGoals.map((goal) => (
                                              <GoalItem
                                                key={goal.id}
                                                goal={goal}
                                                onToggle={() => handleToggleGoalComplete(goal)}
                                                onDelete={() => handleDeleteGoal(goal.id)}
                                                getProgress={getGoalProgress}
                                                compact
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => openCreateSprint(period.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Dodaj sprint
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <CreatePeriodDialog
        open={showCreatePeriod}
        onOpenChange={setShowCreatePeriod}
        onSuccess={fetchPeriods}
      />
      <CreateSprintDialog
        open={showCreateSprint}
        onOpenChange={setShowCreateSprint}
        periodId={selectedPeriodId}
        onSuccess={fetchPeriods}
      />

      {/* Create Goal Dialog */}
      <Dialog open={showCreateGoal} onOpenChange={setShowCreateGoal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Nowy cel {goalContext?.type === "period" ? "okresowy" : "sprintowy"}
            </DialogTitle>
            <DialogDescription>
              Dodaj cel do {goalContext?.type === "period" ? "okresu" : "sprintu"}
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
                    placeholder="np. książek"
                    value={newGoal.unit}
                    onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Kategoria strategiczna</Label>
                <Select
                  value={newGoal.categoryId}
                  onValueChange={(value) => setNewGoal({ ...newGoal, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię..." />
                  </SelectTrigger>
                  <SelectContent>
                    {strategicCategories.map((category) => (
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
                {strategicCategories.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Brak kategorii strategicznych. Dodaj je w Ustawieniach.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateGoal(false)}>
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

// Goal Item Component
function GoalItem({
  goal,
  onToggle,
  onDelete,
  getProgress,
  compact = false,
}: {
  goal: Goal
  onToggle: () => void
  onDelete: () => void
  getProgress: (goal: Goal) => number
  compact?: boolean
}) {
  const progress = getProgress(goal)

  return (
    <div
      className={`flex items-center justify-between rounded-md border p-2 ${
        goal.isCompleted ? "opacity-60 bg-muted/50" : "bg-background"
      } ${compact ? "text-sm" : ""}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "h-6 w-6" : "h-8 w-8"}
          onClick={onToggle}
        >
          <Check
            className={`${compact ? "h-3 w-3" : "h-4 w-4"} ${
              goal.isCompleted ? "text-green-500" : "text-muted-foreground"
            }`}
          />
        </Button>
        <span className={`truncate ${goal.isCompleted ? "line-through" : ""}`}>
          {goal.title}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {goal.targetValue && (
          <div className="flex items-center gap-2">
            <span className={`${compact ? "text-xs" : "text-sm"} text-muted-foreground whitespace-nowrap`}>
              {goal.currentValue}/{goal.targetValue} {goal.unit}
            </span>
            <Progress value={progress} className={compact ? "w-12" : "w-16"} />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "h-6 w-6" : "h-8 w-8"}
          onClick={onDelete}
        >
          <Trash2 className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-destructive`} />
        </Button>
      </div>
    </div>
  )
}
