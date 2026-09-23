"use client"

import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { ArrowRight, CalendarCheck, ClipboardCheck, Flag, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  checkInForWeek,
  currentSprint,
  dayKeyToLocalDate,
  lastEndedSprint,
  quarterLabel,
  quarterPhase,
  shiftQuarter,
  toDayKey,
  weekStartKey,
  type QuarterPayload,
  type QuarterRef,
  type QuarterSprint,
} from "@/lib/quarters"

export type Ritual =
  | { kind: "close_sprint"; sprint: QuarterSprint }
  | { kind: "plan_sprint"; sprint: QuarterSprint; upcoming: boolean }
  | { kind: "check_in"; weekStart: string }
  | { kind: "review_quarter" }
  | { kind: "plan_next_quarter"; next: QuarterRef }

/** What the quarter needs from the user right now, most urgent first */
export function computeRituals(quarter: QuarterPayload, today: string): Ritual[] {
  const ref = { year: quarter.year, quarter: quarter.quarter }
  const phase = quarterPhase(ref, today)
  const rituals: Ritual[] = []
  const activeGoals = quarter.goals.filter((g) => !g.isCompleted)

  // Close the sprint that just ended (review + retro)
  const ended = lastEndedSprint(quarter.sprints, today)
  if (ended && !ended.closedAt && (ended.plannedAt || ended.commitments.length > 0)) {
    rituals.push({ kind: "close_sprint", sprint: ended })
  }

  // Plan the current sprint (or the first one before the quarter starts)
  if (quarter.goals.length > 0 && (phase === "sprints" || phase === "upcoming")) {
    const target = currentSprint(quarter.sprints, today) ?? (phase === "upcoming" ? quarter.sprints[0] : null)
    if (target && !target.plannedAt) {
      rituals.push({ kind: "plan_sprint", sprint: target, upcoming: phase === "upcoming" })
    }
  }

  // Weekly check-in - from the first full week after the goal was set
  if ((phase === "sprints" || phase === "review") && activeGoals.length > 0) {
    const weekStart = weekStartKey(today)
    const hasEarlierGoals = activeGoals.some((g) => toDayKey(g.createdAt) < weekStart)
    const allDone = activeGoals.every((g) => checkInForWeek(g, weekStart))
    if (hasEarlierGoals && !allDone) rituals.push({ kind: "check_in", weekStart })
  }

  if ((phase === "review" || phase === "past") && !quarter.reviewedAt && quarter.goals.length > 0) {
    rituals.push({ kind: "review_quarter" })
  }

  if (phase === "review") {
    rituals.push({ kind: "plan_next_quarter", next: shiftQuarter(ref, 1) })
  }

  return rituals
}

const shortDate = (key: string) => format(dayKeyToLocalDate(key), "d MMMM", { locale: pl })

function describe(ritual: Ritual) {
  switch (ritual.kind) {
    case "close_sprint":
      return {
        icon: ClipboardCheck,
        title: `${ritual.sprint.name} się skończył: zamknij go`,
        text: "Przegląd zobowiązań, 3 pytania retro i decyzja, co przechodzi dalej.",
        time: "~5 min",
        action: "Zamknij sprint",
      }
    case "plan_sprint":
      return {
        icon: ListChecks,
        title: ritual.upcoming
          ? `Zaplanuj ${ritual.sprint.name} (start ${shortDate(ritual.sprint.startKey)})`
          : `Zaplanuj ${ritual.sprint.name}`,
        text: "Jeden cel sprintu i 3–5 zobowiązań, które popchną cele kwartału.",
        time: "~10 min",
        action: "Planuj sprint",
      }
    case "check_in":
      return {
        icon: CalendarCheck,
        title: "Check-in tygodniowy",
        text: "Wpisz aktualne liczby, działanie tygodniowe i pewność. Bez tego cele znikają z radaru.",
        time: "~2 min",
        action: "Zrób check-in",
      }
    case "review_quarter":
      return {
        icon: Flag,
        title: "Przegląd kwartału",
        text: "Oceń cele, zapisz wnioski i zdecyduj, co przechodzi na następny kwartał.",
        time: "~20 min",
        action: "Zacznij przegląd",
      }
    case "plan_next_quarter":
      return {
        icon: ArrowRight,
        title: `Zaplanuj ${quarterLabel(ritual.next)}`,
        text: "Tydzień przeglądu to najlepszy moment, żeby ustawić cele na kolejny kwartał.",
        time: null,
        action: "Przejdź",
      }
  }
}

export function RitualList({ rituals, onAction }: { rituals: Ritual[]; onAction: (ritual: Ritual) => void }) {
  if (rituals.length === 0) return null

  return (
    <div className="space-y-2">
      {rituals.map((ritual, i) => {
        const { icon: Icon, title, text, time, action } = describe(ritual)
        return (
          <div
            key={`${ritual.kind}-${i}`}
            className="flex flex-col gap-3 rounded-lg border border-l-4 border-l-primary bg-card p-3 sm:flex-row sm:items-center sm:p-4"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium leading-snug">
                  {title}
                  {time && <span className="ml-2 text-xs font-normal text-muted-foreground">{time}</span>}
                </p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant={i === 0 ? "default" : "outline"}
              className="shrink-0 self-end sm:self-auto"
              onClick={() => onAction(ritual)}
            >
              {action}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
