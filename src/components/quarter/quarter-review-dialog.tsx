"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { quarterRequest } from "@/hooks/use-quarter"
import {
  formatNumber,
  goalProgress,
  quarterLabel,
  shiftQuarter,
  type QuarterPayload,
  type QuarterRef,
} from "@/lib/quarters"

interface GoalReviewDraft {
  score: number
  reviewNote: string
  carryOver: boolean
}

export function QuarterReviewDialog({
  open,
  onOpenChange,
  quarter,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quarter: QuarterPayload
  onSaved: (carriedTo: QuarterRef | null) => void
}) {
  const nextRef = shiftQuarter({ year: quarter.year, quarter: quarter.quarter }, 1)
  const [drafts, setDrafts] = useState<Record<string, GoalReviewDraft>>({})
  const [reviewNotes, setReviewNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const next: Record<string, GoalReviewDraft> = {}
    for (const goal of quarter.goals) {
      const progress = goal.isCompleted ? 1 : goalProgress(goal.keyResults) ?? 0
      next[goal.id] = {
        score: goal.score ?? Math.round(progress * 10) / 10,
        reviewNote: goal.reviewNote ?? "",
        carryOver: !goal.carriedOver && !goal.isCompleted && progress < 1,
      }
    }
    setDrafts(next)
    setReviewNotes(quarter.reviewNotes ?? "")
  }, [open, quarter])

  const update = (goalId: string, patch: Partial<GoalReviewDraft>) =>
    setDrafts((prev) => ({ ...prev, [goalId]: { ...prev[goalId], ...patch } }))

  const save = async () => {
    setSaving(true)
    try {
      const goals = quarter.goals.map((goal) => ({
        id: goal.id,
        score: drafts[goal.id]?.score ?? null,
        reviewNote: drafts[goal.id]?.reviewNote.trim() || null,
        carryOver: drafts[goal.id]?.carryOver ?? false,
      }))
      await quarterRequest(`/api/quarters/${quarter.id}/review`, "POST", { reviewNotes, goals })
      const carried = goals.some((g) => g.carryOver)
      toast.success(carried ? `Przegląd zapisany, cele przeniesione do ${quarterLabel(nextRef)}` : "Przegląd zapisany")
      onOpenChange(false)
      onSaved(carried ? nextRef : null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać przeglądu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Przegląd {quarter.name}</DialogTitle>
          <DialogDescription>
            Oceń każdy cel w skali 0–1. Przy ambitnym celu 0,7 to dobry wynik; stałe 1,0 znaczy zwykle, że cele były
            za łatwe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {quarter.goals.map((goal) => {
            const draft = drafts[goal.id]
            if (!draft) return null
            const progress = goalProgress(goal.keyResults)
            return (
              <div key={goal.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{goal.title}</p>
                  {progress !== null && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      wg liczb: {Math.round(progress * 100)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={draft.score}
                    onChange={(e) => update(goal.id, { score: Number(e.target.value) })}
                    className="flex-1 accent-primary"
                    aria-label={`Ocena: ${goal.title}`}
                  />
                  <span className="w-10 text-right font-semibold tabular-nums">{formatNumber(draft.score)}</span>
                </div>
                <Input
                  value={draft.reviewNote}
                  onChange={(e) => update(goal.id, { reviewNote: e.target.value })}
                  placeholder="Czego ten cel Cię nauczył?"
                  className="h-9"
                  aria-label="Wniosek"
                />
                {goal.carriedOver ? (
                  <p className="text-xs text-muted-foreground">Już przeniesiony do {quarterLabel(nextRef)}</p>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.carryOver}
                      onChange={(e) => update(goal.id, { carryOver: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    Kontynuuj w {quarterLabel(nextRef)} (liczby startują od obecnych)
                  </label>
                )}
              </div>
            )
          })}

          <div className="space-y-2">
            <Label htmlFor="quarter-notes">Wnioski z kwartału</Label>
            <Textarea
              id="quarter-notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Co powtórzyć, czego unikać, co zmienić w sposobie planowania?"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz przegląd"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
