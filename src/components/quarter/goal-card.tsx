"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, Clock, Gauge, MoreHorizontal, Pencil, Plus, Shield, Trash2, Undo2, Footprints, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { quarterRequest } from "@/hooks/use-quarter"
import { cn } from "@/lib/utils"
import {
  formatDuration,
  formatNumber,
  goalProgress,
  keyResultExpectedValue,
  keyResultProgress,
  latestCheckIn,
  paceStatus,
  type QuarterGoal,
  type QuarterKeyResult,
} from "@/lib/quarters"
import { PaceBadge, PaceBar } from "./pace"

export function parseDecimal(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".")
  if (normalized === "") return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function KeyResultRow({
  keyResult,
  elapsed,
  onSaved,
}: {
  keyResult: QuarterKeyResult
  elapsed: number
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)

  const progress = keyResultProgress(keyResult)
  const status = paceStatus(progress, elapsed)
  const expectedValue = keyResultExpectedValue(keyResult, elapsed)
  const unit = keyResult.unit ? ` ${keyResult.unit}` : ""

  const startEditing = () => {
    setValue(String(keyResult.currentValue).replace(".", ","))
    setEditing(true)
  }

  const save = async () => {
    const parsed = parseDecimal(value)
    if (parsed === null) {
      toast.error("Wpisz liczbę")
      return
    }
    setSaving(true)
    try {
      await quarterRequest(`/api/key-results/${keyResult.id}`, "PATCH", { currentValue: parsed })
      setEditing(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-muted-foreground" title={keyResult.title}>
          {keyResult.title}
        </span>
        {editing ? (
          <form
            className="flex shrink-0 items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              inputMode="decimal"
              className="h-7 w-20 text-right text-sm"
              autoFocus
              aria-label={`Aktualna wartość: ${keyResult.title}`}
            />
            <span className="text-xs text-muted-foreground">/ {formatNumber(keyResult.targetValue)}{unit}</span>
            <Button type="submit" size="icon" variant="ghost" className="h-7 w-7" disabled={saving} aria-label="Zapisz">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setEditing(false)}
              aria-label="Anuluj"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 rounded px-1 tabular-nums hover:bg-muted"
            title="Kliknij, aby zaktualizować"
          >
            <span className="font-semibold">{formatNumber(keyResult.currentValue)}</span>
            <span className="text-muted-foreground"> / {formatNumber(keyResult.targetValue)}{unit}</span>
          </button>
        )}
      </div>
      <PaceBar progress={progress} expected={elapsed} status={status} />
      {elapsed > 0 && elapsed < 1 && progress < 1 && (
        <p className="text-[11px] text-muted-foreground">
          Plan na dziś: {formatNumber(Math.round(expectedValue * 10) / 10)}{unit}
        </p>
      )}
    </div>
  )
}

export function GoalCard({
  goal,
  index,
  elapsed,
  onEdit,
  onChanged,
}: {
  goal: QuarterGoal
  index: number
  elapsed: number
  onEdit: (goal: QuarterGoal) => void
  onChanged: () => void
}) {
  const progress = goalProgress(goal.keyResults)
  const status = goal.isCompleted ? "done" : progress !== null ? paceStatus(progress, elapsed) : null
  const checkIn = latestCheckIn(goal)

  const toggleCompleted = async () => {
    try {
      await quarterRequest(`/api/quarter-goals/${goal.id}`, "PATCH", { isCompleted: !goal.isCompleted })
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać")
    }
  }

  const remove = async () => {
    if (!confirm("Usunąć ten cel? Znikną też jego rezultaty, check-iny i zobowiązania w sprintach.")) return
    try {
      await quarterRequest(`/api/quarter-goals/${goal.id}`, "DELETE")
      toast.success("Cel usunięty")
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się usunąć")
    }
  }

  return (
    <Card className={cn("flex flex-col", goal.isCompleted && "border-emerald-300 dark:border-emerald-900")}>
      <CardContent className="flex flex-1 flex-col gap-4 p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: goal.category?.color ?? "hsl(var(--primary))" }}
            title={goal.category?.name}
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className={cn("font-semibold leading-snug", goal.isCompleted && "text-muted-foreground line-through")}>
              {goal.title}
            </h3>
            {goal.why && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{goal.why}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0" aria-label="Opcje celu">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(goal)}>
                <Pencil className="mr-2 h-4 w-4" /> Edytuj
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleCompleted}>
                {goal.isCompleted ? (
                  <>
                    <Undo2 className="mr-2 h-4 w-4" /> Przywróć jako aktywny
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Oznacz jako osiągnięty
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Usuń
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {status && (
          <div className="-mt-2 flex flex-wrap items-center gap-2">
            <PaceBadge status={status} />
            {goal.score !== null && (
              <span className="text-xs text-muted-foreground">Ocena: {formatNumber(goal.score)}</span>
            )}
            {goal.carriedOver && (
              <span className="text-xs text-muted-foreground">Kontynuowany w kolejnym kwartale</span>
            )}
          </div>
        )}

        {/* Key results */}
        {goal.keyResults.length > 0 ? (
          <div className="space-y-3">
            {goal.keyResults.map((kr) => (
              <KeyResultRow key={kr.id} keyResult={kr} elapsed={elapsed} onSaved={onChanged} />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onEdit(goal)}
            className="flex items-center gap-2 rounded-md border border-dashed border-amber-400/70 p-3 text-left text-sm text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Brak liczby. Dodaj rezultat, żeby widzieć tempo.
          </button>
        )}

        {/* Obstacle plan */}
        {(goal.obstacle || goal.ifThenPlan) && (
          <div className="flex gap-2 rounded-md bg-muted/60 p-2.5 text-xs">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="space-y-0.5">
              {goal.obstacle && (
                <p>
                  <span className="font-medium">Przeszkoda:</span> {goal.obstacle}
                </p>
              )}
              {goal.ifThenPlan && (
                <p>
                  <span className="font-medium">Plan:</span> {goal.ifThenPlan}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer: lead measure, confidence, time */}
        <div className="mt-auto space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
          {goal.leadMeasure && (
            <div className="flex items-center gap-1.5">
              <Footprints className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate" title={goal.leadMeasure}>
                {goal.leadMeasure}
                {goal.leadTarget ? ` · ${formatNumber(goal.leadTarget)}/tydz.` : ""}
              </span>
              {checkIn?.leadActual != null && (
                <span className="ml-auto shrink-0 font-medium text-foreground">
                  ost. tydzień: {formatNumber(checkIn.leadActual)}
                  {goal.leadTarget ? `/${formatNumber(goal.leadTarget)}` : ""}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" />
              {checkIn?.confidence != null ? `Pewność ${checkIn.confidence}/10` : "Bez check-inu"}
            </span>
            {goal.trackedSeconds > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(goal.trackedSeconds)} pracy
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
