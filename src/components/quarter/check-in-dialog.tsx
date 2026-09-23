"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { quarterRequest } from "@/hooks/use-quarter"
import { cn } from "@/lib/utils"
import {
  addDaysToKey,
  checkInForWeek,
  dayKeyToLocalDate,
  formatNumber,
  quarterWeek,
  weekStartKey,
  type QuarterPayload,
} from "@/lib/quarters"
import { parseDecimal } from "./goal-card"

interface GoalDraft {
  keyResults: Record<string, string>
  leadActual: string
  confidence: number | null
  note: string
}

const numberText = (value: number) => formatNumber(value).replace(/\s/g, "")

export function CheckInDialog({
  open,
  onOpenChange,
  quarter,
  today,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quarter: QuarterPayload
  today: string
  onSaved: () => void
}) {
  const weekStart = weekStartKey(today)
  const goals = quarter.goals.filter((g) => !g.isCompleted)
  const [drafts, setDrafts] = useState<Record<string, GoalDraft>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const next: Record<string, GoalDraft> = {}
    for (const goal of quarter.goals) {
      const existing = checkInForWeek(goal, weekStart)
      next[goal.id] = {
        keyResults: Object.fromEntries(goal.keyResults.map((kr) => [kr.id, numberText(kr.currentValue)])),
        leadActual: existing?.leadActual != null ? numberText(existing.leadActual) : "",
        confidence: existing?.confidence ?? null,
        note: existing?.note ?? "",
      }
    }
    setDrafts(next)
  }, [open, quarter.goals, weekStart])

  const update = (goalId: string, patch: Partial<GoalDraft>) =>
    setDrafts((prev) => ({ ...prev, [goalId]: { ...prev[goalId], ...patch } }))

  const save = async () => {
    const items = []
    for (const goal of goals) {
      const draft = drafts[goal.id]
      if (!draft) continue
      const keyResults = []
      for (const kr of goal.keyResults) {
        const value = parseDecimal(draft.keyResults[kr.id] ?? "")
        if (value === null) {
          toast.error(`Wpisz liczbę: ${kr.title}`)
          return
        }
        keyResults.push({ id: kr.id, currentValue: value })
      }
      items.push({
        goalId: goal.id,
        confidence: draft.confidence,
        leadActual: parseDecimal(draft.leadActual),
        note: draft.note.trim() || null,
        keyResults,
      })
    }

    setSaving(true)
    try {
      await quarterRequest(`/api/quarters/${quarter.id}/check-in`, "POST", { today, items })
      toast.success("Check-in zapisany")
      onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać check-inu")
    } finally {
      setSaving(false)
    }
  }

  const weekLabel = `${format(dayKeyToLocalDate(weekStart), "d MMM", { locale: pl })} – ${format(
    dayKeyToLocalDate(addDaysToKey(weekStart, 6)),
    "d MMM",
    { locale: pl }
  )}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Check-in · tydzień {quarterWeek({ year: quarter.year, quarter: quarter.quarter }, today)}/13
          </DialogTitle>
          <DialogDescription>
            {weekLabel}. Zaktualizuj liczby i szczerze oceń szanse. Zapisywanie postępu to jedna z najlepiej
            potwierdzonych metod dowożenia celów.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {goals.length === 0 && (
            <p className="text-sm text-muted-foreground">Brak aktywnych celów w tym kwartale.</p>
          )}
          {goals.map((goal) => {
            const draft = drafts[goal.id]
            if (!draft) return null
            return (
              <div key={goal.id} className="space-y-3 rounded-lg border p-3">
                <p className="flex items-center gap-2 font-medium">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: goal.category?.color ?? "hsl(var(--primary))" }}
                  />
                  {goal.title}
                </p>

                {goal.keyResults.map((kr) => (
                  <div key={kr.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={kr.title}>
                      {kr.title}
                    </span>
                    <Input
                      value={draft.keyResults[kr.id] ?? ""}
                      onChange={(e) =>
                        update(goal.id, { keyResults: { ...draft.keyResults, [kr.id]: e.target.value } })
                      }
                      inputMode="decimal"
                      className="h-8 w-24 text-right"
                      aria-label={kr.title}
                    />
                    <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                      / {formatNumber(kr.targetValue)} {kr.unit ?? ""}
                    </span>
                  </div>
                ))}

                {goal.leadMeasure && (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {goal.leadMeasure} <span className="text-xs">(ostatnie 7 dni)</span>
                    </span>
                    <Input
                      value={draft.leadActual}
                      onChange={(e) => update(goal.id, { leadActual: e.target.value })}
                      inputMode="decimal"
                      className="h-8 w-24 text-right"
                      aria-label={goal.leadMeasure}
                      placeholder="0"
                    />
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">
                      {goal.leadTarget ? `/ ${formatNumber(goal.leadTarget)} tygodniowo` : ""}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">Pewność, że cel zostanie osiągnięty (1–10)</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => update(goal.id, { confidence: draft.confidence === value ? null : value })}
                        className={cn(
                          "h-8 w-8 rounded-md border text-sm tabular-nums transition-colors",
                          draft.confidence === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                          value <= 3 && draft.confidence !== value && "text-red-600 dark:text-red-400",
                          value >= 8 && draft.confidence !== value && "text-emerald-600 dark:text-emerald-400"
                        )}
                        aria-pressed={draft.confidence === value}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  value={draft.note}
                  onChange={(e) => update(goal.id, { note: e.target.value })}
                  placeholder="Notatka (opcjonalnie): co blokuje, co pomogło"
                  className="h-8 text-sm"
                  aria-label="Notatka"
                />
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={save} disabled={saving || goals.length === 0}>
            {saving ? "Zapisywanie…" : "Zapisz check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
