"use client"

import { useState, useCallback } from "react"
import { Plus, Target, Check, Trash2, Pencil, ChevronDown, ChevronRight, Calendar, Zap, Save, X } from "lucide-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Skeleton, SkeletonStats } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useGoals } from "@/hooks/use-goals"
import { useCategories } from "@/hooks/use-categories"
import useSWR from "swr"

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

// Goal card component - moved outside to prevent re-renders
function GoalCard({
  goal,
  onToggleComplete,
  onDelete,
  onEdit,
  editingGoalId,
  editingTitle,
  setEditingTitle,
  onSaveEdit,
  onCancelEdit,
}: {
  goal: Goal
  onToggleComplete: (goal: Goal) => void
  onDelete: (id: string) => void
  onEdit: (goal: Goal) => void
  editingGoalId: string | null
  editingTitle: string
  setEditingTitle: (title: string) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
}) {
  const isEditing = editingGoalId === goal.id
  const getProgress = (g: Goal) => {
    if (!g.targetValue) return g.isCompleted ? 100 : 0
    return Math.min(100, (g.currentValue / g.targetValue) * 100)
  }

  return (
    <div
      className={`p-2 rounded border ${
        goal.isCompleted ? "bg-green-50 border-green-200 dark:bg-green-950/20" : "bg-background"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <div className="flex-1 flex gap-1">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSaveEdit(goal.id)
                } else if (e.key === "Escape") {
                  onCancelEdit()
                }
              }}
              className="h-7 text-sm"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onSaveEdit(goal.id)}
            >
              <Save className="h-3 w-3 text-green-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onCancelEdit}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <span className={`text-sm ${goal.isCompleted ? "line-through text-muted-foreground" : ""}`}>
              {goal.title}
            </span>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(goal)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onToggleComplete(goal)}
              >
                <Check className={`h-3 w-3 ${goal.isCompleted ? "text-green-500" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onDelete(goal.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </>
        )}
      </div>
      {goal.targetValue ? (
        <div className="mt-1">
          <Progress value={getProgress(goal)} className="h-1" />
          <span className="text-[10px] text-muted-foreground">
            {goal.currentValue}/{goal.targetValue} {goal.unit}
          </span>
        </div>
      ) : (
        <Badge variant="secondary" className="text-[10px] mt-1">Cel jakościowy</Badge>
      )}
    </div>
  )
}

// Category template component - moved outside to prevent re-renders
function CategoryTemplate({
  category,
  periodId,
  sprintId,
  categoryGoals,
  inputValue,
  onInputChange,
  onSave,
  onToggleComplete,
  onDelete,
  onEdit,
  editingGoalId,
  editingTitle,
  setEditingTitle,
  onSaveEdit,
  onCancelEdit,
}: {
  category: Category
  periodId?: string
  sprintId?: string
  categoryGoals: Goal[]
  inputValue: string
  onInputChange: (key: string, value: string) => void
  onSave: (categoryId: string, periodId?: string, sprintId?: string) => void
  onToggleComplete: (goal: Goal) => void
  onDelete: (id: string) => void
  onEdit: (goal: Goal) => void
  editingGoalId: string | null
  editingTitle: string
  setEditingTitle: (title: string) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
}) {
  const key = sprintId ? `sprint-${sprintId}-${category.id}` : `period-${periodId}-${category.id}`

  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="font-medium text-sm">{category.name}</span>
        {categoryGoals.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">{categoryGoals.length}</Badge>
        )}
      </div>

      {/* Existing goals */}
      {categoryGoals.length > 0 && (
        <div className="space-y-2 mb-2">
          {categoryGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onEdit={onEdit}
              editingGoalId={editingGoalId}
              editingTitle={editingTitle}
              setEditingTitle={setEditingTitle}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
            />
          ))}
        </div>
      )}

      {/* Input for new goal */}
      <div className="flex gap-2">
        <Input
          placeholder="Wpisz cel..."
          value={inputValue}
          onChange={(e) => onInputChange(key, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(category.id, periodId, sprintId)
            }
          }}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2"
          onClick={() => onSave(category.id, periodId, sprintId)}
          disabled={!inputValue.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const { workspace } = useWorkspaceStore()

  // Use SWR hooks for data fetching with cache
  const { goals, isLoading: goalsLoading, mutate: mutateGoals } = useGoals()
  const { categories, isLoading: categoriesLoading } = useCategories()

  // Fetch periods with sprints
  const { data: periods = [], isLoading: periodsLoading } = useSWR<Period[]>(
    `/api/periods?workspace=${workspace}`
  )

  const isLoading = goalsLoading || categoriesLoading || periodsLoading

  // Expanded state - auto-expand active period/sprint on first load
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(() => {
    const activePeriod = periods.find((p: Period) => p.isActive)
    return activePeriod ? new Set([activePeriod.id]) : new Set()
  })
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(() => {
    const activePeriod = periods.find((p: Period) => p.isActive)
    if (activePeriod) {
      const today = new Date()
      const currentSprint = activePeriod.sprints.find((s: Sprint) => {
        const start = new Date(s.startDate)
        const end = new Date(s.endDate)
        return today >= start && today <= end
      })
      return currentSprint ? new Set([currentSprint.id]) : new Set()
    }
    return new Set()
  })

  // Template input states - keyed by "periodId-categoryId" or "sprintId-categoryId"
  const [templateInputs, setTemplateInputs] = useState<Record<string, string>>({})

  // Editing state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  const handleToggleComplete = async (goal: Goal) => {
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !goal.isCompleted }),
      })
      if (res.ok) {
        mutateGoals()
        toast.success(goal.isCompleted ? "Cel oznaczony jako nieukończony" : "Cel ukończony!")
      } else {
        toast.error("Nie udało się zaktualizować celu")
      }
    } catch (error) {
      console.error("Error updating goal:", error)
      toast.error("Wystąpił błąd")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten cel?")) return
    try {
      const res = await fetch(`/api/goals/${id}`, { method: "DELETE" })
      if (res.ok) {
        mutateGoals()
        toast.success("Cel usunięty")
      } else {
        toast.error("Nie udało się usunąć celu")
      }
    } catch (error) {
      console.error("Error deleting goal:", error)
      toast.error("Wystąpił błąd podczas usuwania")
    }
  }

  const handleEdit = (goal: Goal) => {
    setEditingGoalId(goal.id)
    setEditingTitle(goal.title)
  }

  const handleCancelEdit = () => {
    setEditingGoalId(null)
    setEditingTitle("")
  }

  const handleSaveEdit = async (id: string) => {
    if (!editingTitle.trim()) return
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle.trim() }),
      })
      if (res.ok) {
        setEditingGoalId(null)
        setEditingTitle("")
        mutateGoals()
        toast.success("Cel zaktualizowany")
      } else {
        toast.error("Nie udało się zaktualizować celu")
      }
    } catch (error) {
      console.error("Error updating goal:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Save goal from template
  const handleSaveFromTemplate = async (
    categoryId: string,
    periodId?: string,
    sprintId?: string
  ) => {
    const key = sprintId ? `sprint-${sprintId}-${categoryId}` : `period-${periodId}-${categoryId}`
    const title = templateInputs[key]?.trim()

    if (!title) return

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          categoryId,
          periodId: periodId || undefined,
          sprintId: sprintId || undefined,
          workspaceType: workspace,
        }),
      })
      if (res.ok) {
        setTemplateInputs((prev) => ({ ...prev, [key]: "" }))
        mutateGoals()
        toast.success("Cel dodany")
      } else {
        toast.error("Nie udało się dodać celu")
      }
    } catch (error) {
      console.error("Error creating goal:", error)
      toast.error("Wystąpił błąd podczas tworzenia celu")
    }
  }

  const handleInputChange = (key: string, value: string) => {
    setTemplateInputs((prev) => ({ ...prev, [key]: value }))
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

  const strategicCategories = categories.filter((c) => c.isStrategic)

  // Get goals for a specific context (period or sprint) and category
  // Now includes completed goals too!
  const getGoalsForCategory = (categoryId: string, periodId?: string, sprintId?: string) => {
    return goals.filter((g) => {
      if (g.category?.id !== categoryId) return false
      if (sprintId) {
        return g.sprint?.id === sprintId
      }
      // Period goals (not assigned to any sprint)
      return g.period?.id === periodId && !g.sprint
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Periods skeleton */}
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <div>
                    <Skeleton className="h-6 w-32 mb-1" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  // Count total goals for a period (period goals + all sprint goals) - now includes completed
  const countPeriodGoals = (periodId: string, sprints: Sprint[]) => {
    const periodGoals = goals.filter(
      (g) => g.period?.id === periodId && !g.sprint
    ).length
    const sprintGoals = sprints.reduce((acc, s) => {
      return acc + goals.filter((g) => g.sprint?.id === s.id).length
    }, 0)
    return periodGoals + sprintGoals
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Cele</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Zarządzaj celami okresowymi i sprintowymi
          </p>
        </div>
      </div>

      {/* Info about strategic categories */}
      {strategicCategories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-4 py-4">
            <Target className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Brak kategorii strategicznych</p>
              <p className="text-sm text-muted-foreground">
                Dodaj kategorie strategiczne w Ustawieniach, aby móc tworzyć cele
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Periods with templates */}
      {periods.map((period) => {
        const today = new Date()
        const isCurrentPeriod = new Date(period.startDate) <= today && today <= new Date(period.endDate)
        const totalGoals = countPeriodGoals(period.id, period.sprints)

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
                  {/* Period-level goals - templates for each category */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Cele okresu
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {strategicCategories.map((category) => (
                        <CategoryTemplate
                          key={category.id}
                          category={category}
                          periodId={period.id}
                          categoryGoals={getGoalsForCategory(category.id, period.id)}
                          inputValue={templateInputs[`period-${period.id}-${category.id}`] || ""}
                          onInputChange={handleInputChange}
                          onSave={handleSaveFromTemplate}
                          onToggleComplete={handleToggleComplete}
                          onDelete={handleDelete}
                          onEdit={handleEdit}
                          editingGoalId={editingGoalId}
                          editingTitle={editingTitle}
                          setEditingTitle={setEditingTitle}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={handleCancelEdit}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Sprints within period */}
                  {period.sprints.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Sprinty
                      </h3>
                      {period.sprints.map((sprint) => {
                        const today = new Date()
                        const isCurrentSprint =
                          new Date(sprint.startDate) <= today && today <= new Date(sprint.endDate)
                        const sprintGoalsCount = goals.filter(
                          (g) => g.sprint?.id === sprint.id
                        ).length

                        return (
                          <Collapsible
                            key={sprint.id}
                            open={expandedSprints.has(sprint.id)}
                            onOpenChange={() => toggleSprint(sprint.id)}
                          >
                            <div
                              className={`border rounded-lg ${
                                isCurrentSprint ? "border-primary/50 bg-primary/5" : ""
                              }`}
                            >
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
                                      <Badge variant="default" className="text-[10px]">
                                        Aktywny
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(sprint.startDate), "d MMM", { locale: pl })} -{" "}
                                      {format(new Date(sprint.endDate), "d MMM", { locale: pl })}
                                    </span>
                                  </div>
                                  <Badge variant="outline">{sprintGoalsCount} celów</Badge>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 pt-0">
                                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    {strategicCategories.map((category) => (
                                      <CategoryTemplate
                                        key={category.id}
                                        category={category}
                                        periodId={period.id}
                                        sprintId={sprint.id}
                                        categoryGoals={getGoalsForCategory(category.id, period.id, sprint.id)}
                                        inputValue={templateInputs[`sprint-${sprint.id}-${category.id}`] || ""}
                                        onInputChange={handleInputChange}
                                        onSave={handleSaveFromTemplate}
                                        onToggleComplete={handleToggleComplete}
                                        onDelete={handleDelete}
                                        onEdit={handleEdit}
                                        editingGoalId={editingGoalId}
                                        editingTitle={editingTitle}
                                        setEditingTitle={setEditingTitle}
                                        onSaveEdit={handleSaveEdit}
                                        onCancelEdit={handleCancelEdit}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )
      })}

      {/* Empty state - no periods */}
      {periods.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak okresów</h3>
            <p className="text-muted-foreground text-center mb-4">
              Stwórz najpierw okres w zakładce Sprinty, aby móc dodawać cele
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
