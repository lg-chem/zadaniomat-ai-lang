"use client"

import { useState } from "react"
import { format, differenceInDays } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Calendar,
  ChevronDown,
  ChevronRight,
  Trash2,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { CreatePeriodDialog } from "@/components/periods/create-period-dialog"
import { CreateSprintDialog } from "@/components/sprints/create-sprint-dialog"
import useSWR from "swr"

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  _count: { tasks: number; goals: number }
}

interface Period {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  sprints: Sprint[]
  _count: { sprints: number; goals: number }
}

export default function SprintsPage() {
  const { workspace } = useWorkspaceStore()

  // Use SWR for data fetching with cache
  const { data: periods = [], isLoading, mutate: mutatePeriods } = useSWR<Period[]>(
    `/api/periods?workspace=${workspace}`
  )

  // Auto-expand active periods on first render
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(() => {
    const activePeriodIds = periods
      .filter((p: Period) => p.isActive)
      .map((p: Period) => p.id)
    return new Set(activePeriodIds)
  })
  const [showCreatePeriod, setShowCreatePeriod] = useState(false)
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)

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

  const handleDeletePeriod = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten okres? Wszystkie sprinty zostaną usunięte.")) {
      return
    }
    try {
      const res = await fetch(`/api/periods/${id}`, { method: "DELETE" })
      if (res.ok) {
        mutatePeriods()
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
        mutatePeriods()
      }
    } catch (error) {
      console.error("Error deleting sprint:", error)
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

  const openCreateSprint = (periodId: string) => {
    setSelectedPeriodId(periodId)
    setEditingSprint(null)
    setShowCreateSprint(true)
  }

  const openEditPeriod = (period: Period) => {
    setEditingPeriod(period)
    setShowCreatePeriod(true)
  }

  const openEditSprint = (sprint: Sprint) => {
    setEditingSprint(sprint)
    setShowCreateSprint(true)
  }

  const handlePeriodDialogClose = (open: boolean) => {
    setShowCreatePeriod(open)
    if (!open) setEditingPeriod(null)
  }

  const handleSprintDialogClose = (open: boolean) => {
    setShowCreateSprint(open)
    if (!open) setEditingSprint(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Periods skeleton */}
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <div>
                    <Skeleton className="h-6 w-40 mb-1" />
                    <Skeleton className="h-4 w-32" />
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

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Okresy i Sprinty</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Zarządzaj okresami i sprintami
          </p>
        </div>
        <Button onClick={() => { setEditingPeriod(null); setShowCreatePeriod(true) }} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nowy okres
        </Button>
      </div>

      {/* Periods List */}
      {periods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak okresów</h3>
            <p className="text-muted-foreground text-center mb-4">
              Stwórz pierwszy okres, aby zacząć planować sprinty
            </p>
            <Button onClick={() => { setEditingPeriod(null); setShowCreatePeriod(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Stwórz okres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 md:space-y-4">
          {periods.map((period) => (
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
                        openEditPeriod(period)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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
                <CardContent className="pt-0 space-y-3">
                  <div className="ml-8">
                    <h3 className="text-base md:text-lg font-semibold mb-3">Sprinty</h3>

                    {period.sprints.length === 0 ? (
                      <p className="text-muted-foreground text-sm py-2">
                        Brak sprintów w tym okresie
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {period.sprints.map((sprint) => {
                          const status = getSprintStatus(sprint)

                          return (
                            <div
                              key={sprint.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card"
                            >
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
                                  onClick={() => openEditSprint(sprint)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteSprint(sprint.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => openCreateSprint(period.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj sprint
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreatePeriodDialog
        open={showCreatePeriod}
        onOpenChange={handlePeriodDialogClose}
        onSuccess={mutatePeriods}
        editPeriod={editingPeriod}
      />
      <CreateSprintDialog
        open={showCreateSprint}
        onOpenChange={handleSprintDialogClose}
        periodId={selectedPeriodId}
        onSuccess={mutatePeriods}
        editSprint={editingSprint}
      />
    </div>
  )
}
