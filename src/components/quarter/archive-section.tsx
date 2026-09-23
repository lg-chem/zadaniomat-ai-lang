"use client"

import { useState } from "react"
import useSWR from "swr"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Archive, Check, ChevronDown, ChevronRight, Circle, CornerDownRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface ArchivedPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  goals: {
    id: string
    title: string
    isCompleted: boolean
    carriedOver: boolean
    category: { id: string; name: string; color: string } | null
  }[]
  sprints: {
    id: string
    name: string
    goals: { id: string; title: string; isCompleted: boolean }[]
  }[]
}

const dateLabel = (value: string) => format(new Date(value), "d MMM yyyy", { locale: pl })

/** Old periods with custom dates - read only, unfinished goals can be continued in a quarter */
export function ArchiveSection({
  carryTargetLabel,
  onCarry,
}: {
  carryTargetLabel: string | null
  onCarry: (goal: { id: string; title: string; categoryId: string | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const { data: periods, isLoading } = useSWR<ArchivedPeriod[]>(open ? "/api/quarters/archive" : null)

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Archive className="h-4 w-4" />
        Archiwum: stare okresy i sprinty
      </button>

      {open && (
        <div className="space-y-3">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {periods && periods.length === 0 && (
            <p className="text-sm text-muted-foreground">Brak starych okresów.</p>
          )}
          {periods?.map((period) => (
            <div key={period.id} className="rounded-lg border bg-card p-4">
              <p className="font-medium">
                {period.name}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {dateLabel(period.startDate)} – {dateLabel(period.endDate)}
                </span>
              </p>
              {period.goals.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {period.goals.map((goal) => (
                    <li key={goal.id} className="flex flex-wrap items-center gap-2 text-sm">
                      {goal.isCompleted ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      {goal.category && (
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: goal.category.color }} />
                      )}
                      <span className="min-w-0 flex-1">{goal.title}</span>
                      {goal.carriedOver ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CornerDownRight className="h-3 w-3" /> przeniesiony
                        </span>
                      ) : (
                        !goal.isCompleted &&
                        carryTargetLabel && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              onCarry({ id: goal.id, title: goal.title, categoryId: goal.category?.id ?? null })
                            }
                          >
                            Kontynuuj w {carryTargetLabel}
                          </Button>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Brak celów okresu.</p>
              )}
              {period.sprints.some((s) => s.goals.length > 0) && (
                <div className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground">
                  {period.sprints
                    .filter((s) => s.goals.length > 0)
                    .map((sprint) => (
                      <p key={sprint.id}>
                        <span className="font-medium text-foreground">{sprint.name}:</span>{" "}
                        {sprint.goals.map((g) => `${g.isCompleted ? "✓" : "○"} ${g.title}`).join(", ")}
                      </p>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
