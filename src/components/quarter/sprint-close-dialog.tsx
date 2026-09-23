"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, Clock } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { formatDuration, type QuarterPayload, type QuarterSprint } from "@/lib/quarters"

export function SprintCloseDialog({
  open,
  onOpenChange,
  quarter,
  sprint,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quarter: QuarterPayload
  sprint: QuarterSprint | null
  onSaved: (nextSprint: QuarterSprint | null) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [carry, setCarry] = useState<Set<string>>(new Set())
  const [wentWell, setWentWell] = useState("")
  const [needsImprovement, setNeedsImprovement] = useState("")
  const [actionItem, setActionItem] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !sprint) return
    setStep(1)
    setCompleted(new Set(sprint.commitments.filter((c) => c.isCompleted).map((c) => c.id)))
    setCarry(new Set(sprint.commitments.filter((c) => !c.isCompleted && !c.carriedOver).map((c) => c.id)))
    setWentWell(sprint.retrospective?.wentWell.join("\n") ?? "")
    setNeedsImprovement(sprint.retrospective?.needsImprovement.join("\n") ?? "")
    setActionItem(sprint.retrospective?.actionItems[0] ?? "")
  }, [open, sprint])

  if (!sprint) return null

  const index = quarter.sprints.findIndex((s) => s.id === sprint.id)
  const nextSprint = index >= 0 && index < quarter.sprints.length - 1 ? quarter.sprints[index + 1] : null
  const total = sprint.commitments.length
  const doneCount = sprint.commitments.filter((c) => completed.has(c.id)).length

  const timeByGoal = quarter.goals
    .map((goal) => ({
      goal,
      seconds: sprint.commitments
        .filter((c) => c.parentGoalId === goal.id)
        .reduce((sum, c) => sum + c.trackedSeconds, 0),
      planned: sprint.commitments.some((c) => c.parentGoalId === goal.id),
    }))
    .filter((row) => row.planned)

  const toggleSet = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set)
    if (on) next.add(id)
    else next.delete(id)
    return next
  }

  const save = async () => {
    setSaving(true)
    try {
      await quarterRequest(`/api/sprints/${sprint.id}/close`, "POST", {
        wentWell,
        needsImprovement,
        actionItem,
        completedIds: Array.from(completed),
        carryOverIds: Array.from(carry).filter((id) => !completed.has(id)),
      })
      toast.success(`${sprint.name} zamknięty`)
      onOpenChange(false)
      onSaved(nextSprint)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zamknąć sprintu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {sprint.closedAt ? "Retro" : "Zamknięcie"}: {sprint.name}
          </DialogTitle>
          <DialogDescription>
            Krok {step} z 2: {step === 1 ? "co zostało zrobione i co idzie dalej" : "3 pytania retro"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            {total > 0 ? (
              <>
                <p className="text-sm">
                  Zrobione: <span className="font-semibold">{doneCount}</span> z {total} zobowiązań
                </p>
                <div className="space-y-2">
                  {sprint.commitments.map((commitment) => {
                    const isDone = completed.has(commitment.id)
                    const willCarry = carry.has(commitment.id)
                    return (
                      <div key={commitment.id} className="rounded-md border p-2.5">
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={(e) => setCompleted(toggleSet(completed, commitment.id, e.target.checked))}
                            className="h-4 w-4 accent-emerald-600"
                          />
                          <span className={cn("text-sm", isDone && "text-muted-foreground line-through")}>
                            {commitment.title}
                          </span>
                        </label>
                        {!isDone && (
                          <div className="ml-6 mt-2 flex flex-wrap gap-1.5">
                            {commitment.carriedOver ? (
                              <span className="text-xs text-muted-foreground">Już przeniesione do kolejnego sprintu</span>
                            ) : nextSprint ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={willCarry ? "default" : "outline"}
                                  className="h-7 text-xs"
                                  onClick={() => setCarry(toggleSet(carry, commitment.id, true))}
                                >
                                  Przenieś do {nextSprint.name}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={!willCarry ? "default" : "outline"}
                                  className="h-7 text-xs"
                                  onClick={() => setCarry(toggleSet(carry, commitment.id, false))}
                                >
                                  Odpuść
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Ostatni sprint kwartału. O tym, co przechodzi dalej, zdecydujesz w przeglądzie kwartału.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {timeByGoal.length > 0 && (
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Czas z timera na zadaniach tego sprintu
                    </p>
                    <ul className="space-y-1 text-sm">
                      {timeByGoal.map(({ goal, seconds }) => (
                        <li key={goal.id} className="flex justify-between gap-3">
                          <span className="min-w-0 truncate">{goal.title}</span>
                          <span className={cn("shrink-0 tabular-nums", seconds === 0 && "text-muted-foreground")}>
                            {seconds > 0 ? formatDuration(seconds) : "0 min"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Ten sprint nie miał zobowiązań. Przejdź do retro i zapisz, co pomoże zaplanować kolejny.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="retro-well">Co zadziałało?</Label>
              <Textarea
                id="retro-well"
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
                placeholder="Jedna rzecz w linii"
                rows={3}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retro-bad">Co nie zadziałało?</Label>
              <Textarea
                id="retro-bad"
                value={needsImprovement}
                onChange={(e) => setNeedsImprovement(e.target.value)}
                placeholder="Jedna rzecz w linii"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retro-change">Jedna zmiana na następny sprint</Label>
              <Input
                id="retro-change"
                value={actionItem}
                onChange={(e) => setActionItem(e.target.value)}
                placeholder="np. Telefony robię przed 10:00, zanim otworzę maila"
              />
              <p className="text-xs text-muted-foreground">
                Pokaże się przy planowaniu i przez cały kolejny sprint.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button onClick={() => setStep(2)}>Dalej: retro</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Wstecz
              </Button>
              <Button onClick={save} disabled={saving}>
                <Check className="mr-1.5 h-4 w-4" />
                {saving ? "Zapisywanie…" : sprint.closedAt ? "Zapisz retro" : "Zamknij sprint"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
