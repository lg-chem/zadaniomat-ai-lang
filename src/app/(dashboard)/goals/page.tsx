"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Target, Check, Trash2, Pencil, ChevronDown, ChevronRight, Calendar, Zap, Save } from "lucide-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
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

  // Expanded state
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set())

  // Template input states - keyed by "periodId-categoryId" or "sprintId-categoryId"
  const [templateInputs, setTemplateInputs] = useState<Record<string, string>>({})

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

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten cel?")) return
    try {
      await fetch(`/api/goals/${id}`, { method: "DELETE" })
      fetchGoals()
    } catch (error) {
      console.error("Error deleting goal:", error)
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
        // Clear input and refresh
        setTemplateInputs((prev) => ({ ...prev, [key]: "" }))
        fetchGoals()
      }
    } catch (error) {
      console.error("Error creating goal:", error)
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

  const strategicCategories = categories.filter((c) => c.isStrategic)

  // Get goals for a specific context (period or sprint) and category
  const getGoalsForCategory = (categoryId: string, periodId?: string, sprintId?: string) => {
    return goals.filter((g) => {
      if (g.isCompleted) return false
      if (g.category?.id !== categoryId) return false
      if (sprintId) {
        return g.sprint?.id === sprintId
      }
      // Period goals (not assigned to any sprint)
      return g.period?.id === periodId && !g.sprint
    })
  }

  // Goal card component
  const GoalCard = ({ goal }: { goal: Goal }) => (
    <div
      className={`p-2 rounded border ${
        goal.isCompleted ? "bg-green-50 border-green-200 dark:bg-green-950/20" : "bg-background"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm ${goal.isCompleted ? "line-through text-muted-foreground" : ""}`}>
          {goal.title}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleToggleComplete(goal)}
          >
            <Check className={`h-3 w-3 ${goal.isCompleted ? "text-green-500" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleDelete(goal.id)}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
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

  // Category template component - shows category with goals and input
  const CategoryTemplate = ({
    category,
    periodId,
    sprintId,
  }: {
    category: Category
    periodId?: string
    sprintId?: string
  }) => {
    const key = sprintId ? `sprint-${sprintId}-${category.id}` : `period-${periodId}-${category.id}`
    const categoryGoals = getGoalsForCategory(category.id, periodId, sprintId)
    const inputValue = templateInputs[key] || ""

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
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )}

        {/* Input for new goal */}
        <div className="flex gap-2">
          <Input
            placeholder="Wpisz cel..."
            value={inputValue}
            onChange={(e) => setTemplateInputs((prev) => ({ ...prev, [key]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveFromTemplate(category.id, periodId, sprintId)
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-8 px-2"
            onClick={() => handleSaveFromTemplate(category.id, periodId, sprintId)}
            disabled={!inputValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
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

  // Count total goals for a period (period goals + all sprint goals)
  const countPeriodGoals = (periodId: string, sprints: Sprint[]) => {
    const periodGoals = goals.filter(
      (g) => g.period?.id === periodId && !g.sprint && !g.isCompleted
    ).length
    const sprintGoals = sprints.reduce((acc, s) => {
      return acc + goals.filter((g) => g.sprint?.id === s.id && !g.isCompleted).length
    }, 0)
    return periodGoals + sprintGoals
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
                          (g) => g.sprint?.id === sprint.id && !g.isCompleted
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

      {/* Completed goals section */}
      {goals.filter((g) => g.isCompleted).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">
              Ukończone cele ({goals.filter((g) => g.isCompleted).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {goals
                .filter((g) => g.isCompleted)
                .map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
