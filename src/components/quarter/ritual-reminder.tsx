"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, BellRing } from "lucide-react"
import { useQuarter } from "@/hooks/use-quarter"
import { defaultQuarter, localDayKey, quarterLabel, quarterOf, shiftQuarter } from "@/lib/quarters"
import { computeRituals, type Ritual } from "./rituals"

function shortTitle(ritual: Ritual): string | null {
  switch (ritual.kind) {
    case "close_sprint":
      return `zamknij ${ritual.sprint.name} (retro)`
    case "plan_sprint":
      return `zaplanuj ${ritual.sprint.name}`
    case "check_in":
      return "check-in tygodniowy"
    case "review_quarter":
      return "przegląd kwartału"
    case "plan_next_quarter":
      return null
  }
}

/** One-line reminder of pending goal rituals, linking to the goals page (WORK only) */
export function QuarterRitualReminder() {
  const [today] = useState(() => localDayKey())
  const currentRef = quarterOf(today)
  const current = useQuarter(currentRef)
  // At the very end of an unplanned quarter the next one is the one to plan
  const next = useQuarter(current.isLoaded && !current.quarter ? shiftQuarter(currentRef, 1) : null)
  const quarter = current.quarter ?? next.quarter

  let items: string[] = []
  if (quarter) {
    items = computeRituals(quarter, today)
      .map(shortTitle)
      .filter((title): title is string => title !== null)
    if (quarter.goals.length === 0) items.unshift(`dodaj cele na ${quarter.name}`)
  } else if (current.isLoaded && next.isLoaded && current.hasQuarters) {
    // Only for people who already plan in quarters - no nagging for those who never used goals
    items = [`zaplanuj ${quarterLabel(defaultQuarter(today, false))}`]
  }

  if (items.length === 0) return null

  const text = items.join(" · ")
  return (
    <Link
      href="/goals"
      className="mt-2 inline-flex max-w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm transition-colors hover:bg-primary/10"
    >
      <BellRing className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 truncate">
        <span className="font-medium">Cele:</span> {text}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
