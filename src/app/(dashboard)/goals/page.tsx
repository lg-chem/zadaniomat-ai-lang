"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Plus, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { quarterRequest, useQuarter } from "@/hooks/use-quarter"
import {
  buildQuarterSchedule,
  currentSprint,
  dayKeyToLocalDate,
  defaultQuarter,
  lastEndedSprint,
  latestCheckIn,
  leadExecution,
  localDayKey,
  quarterElapsed,
  quarterLabel,
  quarterOf,
  quarterPhase,
  quarterWeek,
  RECOMMENDED_MAX_GOALS,
  sameQuarter,
  shiftQuarter,
  type QuarterGoal,
  type QuarterPayload,
  type QuarterRef,
  type QuarterSprint,
} from "@/lib/quarters"
import { ArchiveSection } from "@/components/quarter/archive-section"
import { CheckInDialog } from "@/components/quarter/check-in-dialog"
import { GoalCard } from "@/components/quarter/goal-card"
import { GoalDialog, type GoalPrefill } from "@/components/quarter/goal-dialog"
import { QuarterReviewDialog } from "@/components/quarter/quarter-review-dialog"
import { QuarterTimeline } from "@/components/quarter/quarter-timeline"
import { computeRituals, RitualList, type Ritual } from "@/components/quarter/rituals"
import { SprintCloseDialog } from "@/components/quarter/sprint-close-dialog"
import { SprintPanel } from "@/components/quarter/sprint-panel"
import { SprintPlanDialog } from "@/components/quarter/sprint-plan-dialog"

const dayLabel = (key: string, pattern = "d MMM") => format(dayKeyToLocalDate(key), pattern, { locale: pl })

/** Sprint shown by default: the running one, before the quarter the first, after it the last ended */
function defaultSprint(quarter: QuarterPayload, today: string): QuarterSprint | null {
  if (quarter.sprints.length === 0) return null
  return (
    currentSprint(quarter.sprints, today) ??
    (today < quarter.sprints[0].startKey ? quarter.sprints[0] : lastEndedSprint(quarter.sprints, today)) ??
    quarter.sprints[0]
  )
}

function PlanQuarter({
  quarterRef,
  today,
  creating,
  onCreate,
}: {
  quarterRef: QuarterRef
  today: string
  creating: boolean
  onCreate: () => void
}) {
  const schedule = buildQuarterSchedule(quarterRef)
  const phase = quarterPhase(quarterRef, today)
  const steps = [
    {
      title: "Maks. 3 cele z liczbami",
      text: "Po czym poznasz, że się udało? Start → cel na koniec kwartału.",
    },
    {
      title: "Sprint co 2 tygodnie",
      text: "Jeden cel sprintu, 3–5 zobowiązań i krótkie retro na koniec.",
    },
    {
      title: "Check-in co tydzień",
      text: "2 minuty: aktualne liczby, działanie tygodniowe i pewność.",
    },
  ]

  return (
    <Card>
      <CardContent className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-center md:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Target className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">
            {phase === "past" ? `${quarterLabel(quarterRef)} nie był planowany` : `Zaplanuj ${quarterLabel(quarterRef)}`}
          </h2>
          <p className="text-muted-foreground">
            {phase === "upcoming" && `Startuje ${dayLabel(schedule.startKey, "d MMMM")}. `}
            Kwartał to 6 sprintów po 2 tygodnie i tydzień przeglądu na końcu.
          </p>
        </div>
        <ol className="grid gap-3 text-left sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">
                <span className="mr-1.5 text-primary">{i + 1}.</span>
                {step.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap justify-center gap-1.5 text-xs text-muted-foreground">
          {schedule.sprints.map((s) => (
            <span key={s.number} className="rounded-full border px-2 py-0.5">
              S{s.number}: {dayLabel(s.startKey)} – {dayLabel(s.endKey)}
            </span>
          ))}
          <span className="rounded-full border border-dashed px-2 py-0.5">
            Przegląd: {dayLabel(schedule.reviewStartKey)} – {dayLabel(schedule.endKey)}
          </span>
        </div>
        {phase !== "past" && (
          <Button size="lg" onClick={onCreate} disabled={creating}>
            <CalendarRange className="mr-2 h-4 w-4" />
            {creating ? "Tworzenie…" : `Zaplanuj ${quarterLabel(quarterRef)}`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const [today] = useState(() => localDayKey())
  const currentRef = useMemo(() => quarterOf(today), [today])
  const current = useQuarter(currentRef)

  // Until the user navigates, show the current quarter (or the next one at the very end of an unplanned quarter)
  const [selectedRef, setSelectedRef] = useState<QuarterRef | null>(null)
  const defaultRef = current.isLoaded ? defaultQuarter(today, current.quarter !== null) : null
  const ref = selectedRef ?? defaultRef
  const view = useQuarter(ref)
  const quarter = view.quarter

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [goalDialog, setGoalDialog] = useState<{ goal: QuarterGoal | null; prefill?: GoalPrefill } | null>(null)
  const [planSprintId, setPlanSprintId] = useState<string | null>(null)
  const [closeSprintId, setCloseSprintId] = useState<string | null>(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const refresh = () => view.mutate()

  const goToQuarter = (next: QuarterRef) => {
    setSelectedRef(next)
    setSelectedSprintId(null)
  }

  const createQuarter = async () => {
    if (!ref) return
    setCreating(true)
    try {
      await quarterRequest("/api/quarters", "POST", ref)
      await view.mutate()
      toast.success(`${quarterLabel(ref)} utworzony. Dodaj cele.`)
      setGoalDialog({ goal: null })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się utworzyć kwartału")
    } finally {
      setCreating(false)
    }
  }

  const handleRitual = (ritual: Ritual) => {
    switch (ritual.kind) {
      case "close_sprint":
        setSelectedSprintId(ritual.sprint.id)
        setCloseSprintId(ritual.sprint.id)
        break
      case "plan_sprint":
        setSelectedSprintId(ritual.sprint.id)
        setPlanSprintId(ritual.sprint.id)
        break
      case "check_in":
        setCheckInOpen(true)
        break
      case "review_quarter":
        setReviewOpen(true)
        break
      case "plan_next_quarter":
        goToQuarter(ritual.next)
        break
    }
  }

  if (!ref || (view.isLoading && !view.isLoaded)) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Cele</h1>
        </div>
        <PageSkeleton />
      </div>
    )
  }

  const elapsed = quarterElapsed(ref, today)
  const phase = quarterPhase(ref, today)
  const rituals = quarter ? computeRituals(quarter, today) : []
  const sprint = quarter
    ? quarter.sprints.find((s) => s.id === selectedSprintId) ?? defaultSprint(quarter, today)
    : null
  const planSprint = quarter?.sprints.find((s) => s.id === planSprintId) ?? null
  const closeSprint = quarter?.sprints.find((s) => s.id === closeSprintId) ?? null
  const goalsCount = quarter?.goals.length ?? 0

  const leadScores = (quarter?.goals ?? [])
    .map((g) => leadExecution(latestCheckIn(g)?.leadActual, g.leadTarget))
    .filter((v): v is number => v !== null)
  const leadScore = leadScores.length > 0 ? leadScores.reduce((a, b) => a + b, 0) / leadScores.length : null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Cele</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Kwartał, sprinty co 2 tygodnie i cotygodniowy check-in
          </p>
        </div>
        <div className="flex items-center gap-1 self-start sm:self-auto">
          <Button variant="ghost" size="icon" onClick={() => goToQuarter(shiftQuarter(ref, -1))} aria-label="Poprzedni kwartał">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-[8.5rem] text-center">
            <p className="font-semibold">{quarterLabel(ref)}</p>
            <p className="text-xs text-muted-foreground">
              {dayLabel(buildQuarterSchedule(ref).startKey)} – {dayLabel(buildQuarterSchedule(ref).endKey)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => goToQuarter(shiftQuarter(ref, 1))} aria-label="Następny kwartał">
            <ChevronRight className="h-5 w-5" />
          </Button>
          {defaultRef && !sameQuarter(ref, defaultRef) && (
            <Button variant="outline" size="sm" className="ml-1" onClick={() => goToQuarter(defaultRef)}>
              Teraz
            </Button>
          )}
        </div>
      </div>

      {!quarter ? (
        <PlanQuarter quarterRef={ref} today={today} creating={creating} onCreate={createQuarter} />
      ) : (
        <>
          {/* Timeline */}
          <div className="space-y-2">
            <QuarterTimeline
              quarter={quarter}
              today={today}
              selectedSprintId={sprint?.id ?? null}
              onSelectSprint={setSelectedSprintId}
            />
            <p className="text-xs text-muted-foreground">
              {phase === "upcoming" && `Start ${dayLabel(quarter.startKey, "d MMMM")}`}
              {(phase === "sprints" || phase === "review") &&
                `Tydzień ${quarterWeek(ref, today)}/13 · minęło ${Math.round(elapsed * 100)}% kwartału`}
              {phase === "past" && "Kwartał zakończony"}
              {leadScore !== null && ` · działania tygodniowe (ost. check-in): ${Math.round(leadScore * 100)}%`}
            </p>
          </div>

          <RitualList rituals={rituals} onAction={handleRitual} />

          {/* Goals */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Cele kwartału <span className="font-normal text-muted-foreground">{goalsCount}</span>
              </h2>
              {goalsCount > 0 && (
                <Button size="sm" variant="outline" onClick={() => setGoalDialog({ goal: null })}>
                  <Plus className="mr-1 h-4 w-4" /> Dodaj cel
                </Button>
              )}
            </div>
            {goalsCount > RECOMMENDED_MAX_GOALS && (
              <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {goalsCount} cele to dużo na jeden kwartał. Rozważ przesunięcie jednego na następny.
              </p>
            )}
            {goalsCount === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="font-medium">Zacznij od celów: maksymalnie 3, każdy z liczbą</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  np. „Marketing, który przyprowadza klientów” → Nowi klienci: 0 → 7, działanie: 20 rozmów tygodniowo
                </p>
                <Button className="mt-4" onClick={() => setGoalDialog({ goal: null })}>
                  <Plus className="mr-1 h-4 w-4" /> Dodaj pierwszy cel
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {quarter.goals.map((goal, i) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    index={i}
                    elapsed={elapsed}
                    onEdit={(g) => setGoalDialog({ goal: g })}
                    onChanged={refresh}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Sprint */}
          {sprint && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Sprint</h2>
              <SprintPanel
                quarter={quarter}
                sprint={sprint}
                today={today}
                onPlan={(s) => setPlanSprintId(s.id)}
                onClose={(s) => setCloseSprintId(s.id)}
                onChanged={refresh}
              />
            </section>
          )}

          <GoalDialog
            open={goalDialog !== null}
            onOpenChange={(open) => !open && setGoalDialog(null)}
            quarterId={quarter.id}
            quarterName={quarter.name}
            goal={goalDialog?.goal ?? null}
            prefill={goalDialog?.prefill}
            goalsCount={goalsCount}
            onSaved={refresh}
          />
          <SprintPlanDialog
            open={planSprint !== null}
            onOpenChange={(open) => !open && setPlanSprintId(null)}
            quarter={quarter}
            sprint={planSprint}
            history={view.history}
            elapsed={elapsed}
            onSaved={refresh}
          />
          <SprintCloseDialog
            open={closeSprint !== null}
            onOpenChange={(open) => !open && setCloseSprintId(null)}
            quarter={quarter}
            sprint={closeSprint}
            onSaved={async (next) => {
              await view.mutate()
              if (next && !next.plannedAt && quarter.goals.length > 0) {
                setSelectedSprintId(next.id)
                setPlanSprintId(next.id)
              }
            }}
          />
          <CheckInDialog
            open={checkInOpen}
            onOpenChange={setCheckInOpen}
            quarter={quarter}
            today={today}
            onSaved={refresh}
          />
          <QuarterReviewDialog
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            quarter={quarter}
            onSaved={async (carriedTo) => {
              await view.mutate()
              if (carriedTo) goToQuarter(carriedTo)
            }}
          />
        </>
      )}

      <ArchiveSection
        carryTargetLabel={quarter ? quarter.name : null}
        onCarry={(goal) =>
          setGoalDialog({
            goal: null,
            prefill: { title: goal.title, categoryId: goal.categoryId, carriedFromGoalId: goal.id },
          })
        }
      />
    </div>
  )
}
