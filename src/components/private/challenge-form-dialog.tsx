"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { Challenge, ChallengeInput } from "@/hooks/use-challenges"
import type { Habit } from "@/hooks/use-habits"
import type { SportActivityType } from "@/hooks/use-sport"
import {
  addDaysKey,
  dayKeyOf,
  diffDays,
  monthEndKey,
  todayKey,
  type ChallengeType,
  type LinkedMetric,
  type LinkedType,
} from "@/lib/tracking"

export const CHALLENGE_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444"]

/** A ready start: fills the form, the rest can be changed */
export interface ChallengeIdea {
  label: string
  name: string
  challengeType: ChallengeType
  linkedType: LinkedType
  targetValue?: string
  unit?: string
  weeklyTarget?: string
}

export const CHALLENGE_IDEAS: ChallengeIdea[] = [
  { label: "20 treningów w miesiącu", name: "20 treningów", challengeType: "NUMERIC", linkedType: "SPORT", targetValue: "20", unit: "treningów" },
  { label: "Trening 3× w tygodniu", name: "Trening 3× w tygodniu", challengeType: "WEEKLY_HABIT", linkedType: "SPORT", weeklyTarget: "3" },
  { label: "Odłożyć kwotę", name: "Oszczędzanie", challengeType: "NUMERIC", linkedType: "NONE", targetValue: "3000", unit: "zł" },
  { label: "Gotuję 5× w tygodniu", name: "Gotuję w domu", challengeType: "WEEKLY_HABIT", linkedType: "NONE", weeklyTarget: "5" },
]

const SOURCES: { value: LinkedType; label: string }[] = [
  { value: "NONE", label: "Wpisuję sam" },
  { value: "HABIT", label: "Z nawyku" },
  { value: "SPORT", label: "Ze sportu" },
  { value: "STEPS", label: "Z kroków" },
]

const TYPES: { value: ChallengeType; label: string; hint: string }[] = [
  { value: "NUMERIC", label: "Łącznie", hint: "np. 20 treningów, 100 km, 3000 zł do końca terminu" },
  { value: "WEEKLY_HABIT", label: "Co tydzień", hint: "np. 3 razy w każdym tygodniu" },
  { value: "MONTHLY_GOAL", label: "Co miesiąc", hint: "raz w każdym miesiącu" },
]

interface FormState {
  name: string
  description: string
  challengeType: ChallengeType
  linkedType: LinkedType
  linkedHabitId: string
  linkedSportTypeId: string
  linkedMetric: LinkedMetric
  startDate: string
  endDate: string
  targetValue: string
  unit: string
  weeklyTarget: string
  color: string
  isPublic: boolean
}

function initialState(challenge?: Challenge | null, idea?: ChallengeIdea | null): FormState {
  const today = todayKey()
  if (challenge) {
    return {
      name: challenge.name,
      description: challenge.description ?? "",
      challengeType: challenge.challengeType,
      linkedType: challenge.linkedType ?? "NONE",
      linkedHabitId: challenge.linkedHabitId ?? "",
      linkedSportTypeId: challenge.linkedSportTypeId ?? "",
      linkedMetric: challenge.linkedMetric ?? "COUNT",
      startDate: dayKeyOf(challenge.startDate),
      endDate: dayKeyOf(challenge.endDate),
      targetValue: challenge.targetValue.toString(),
      unit: challenge.unit,
      weeklyTarget: challenge.weeklyTarget?.toString() ?? "",
      color: challenge.color,
      isPublic: !!challenge.isPublic,
    }
  }
  return {
    name: idea?.name ?? "",
    description: "",
    challengeType: idea?.challengeType ?? "NUMERIC",
    linkedType: idea?.linkedType ?? "NONE",
    linkedHabitId: "",
    linkedSportTypeId: "",
    linkedMetric: "COUNT",
    startDate: today,
    endDate: monthEndKey(today),
    targetValue: idea?.targetValue ?? "",
    unit: idea?.unit ?? "",
    weeklyTarget: idea?.weeklyTarget ?? "",
    color: CHALLENGE_COLORS[0],
    // Private unless shared on purpose
    isPublic: false,
  }
}

/** The unit follows what is counted - typed by hand only for own entries */
function linkedUnit(form: FormState, habits: Habit[]): string | null {
  if (form.linkedType === "NONE") return null
  if (form.linkedType === "STEPS") return "kroków"
  if (form.linkedMetric === "MINUTES") return "min"
  if (form.linkedType === "SPORT") return "treningów"
  if (form.linkedMetric === "VALUE") return habits.find((h) => h.id === form.linkedHabitId)?.unit || "razy"
  return "dni"
}

interface ChallengeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing this challenge; none - a new one */
  challenge?: Challenge | null
  idea?: ChallengeIdea | null
  habits: Habit[]
  sportTypes: SportActivityType[]
  onSubmit: (input: ChallengeInput) => Promise<boolean>
}

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/** New challenge / its settings: what counts (own entries, a habit, sport, steps), the target and the dates */
export function ChallengeFormDialog({ open, onOpenChange, challenge, idea, habits, sportTypes, onSubmit }: ChallengeFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(challenge, idea))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(initialState(challenge, idea))
  }, [open, challenge, idea])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const today = todayKey()
  const numeric = form.challengeType === "NUMERIC"
  const autoUnit = linkedUnit(form, habits)
  const selectedHabit = habits.find((h) => h.id === form.linkedHabitId)
  const chips = sportTypes.filter((t) => t.name !== "Kroki")

  // Weekly / monthly: the target is the number of weeks / months between the dates
  const periods =
    form.startDate && form.endDate && form.endDate >= form.startDate
      ? form.challengeType === "WEEKLY_HABIT"
        ? Math.max(1, Math.ceil((diffDays(form.startDate, form.endDate) + 1) / 7))
        : (Number(form.endDate.slice(0, 4)) - Number(form.startDate.slice(0, 4))) * 12 +
          (Number(form.endDate.slice(5, 7)) - Number(form.startDate.slice(5, 7))) +
          1
      : 0

  const missing =
    !form.name.trim() ||
    !form.startDate ||
    !form.endDate ||
    form.endDate < form.startDate ||
    (numeric && (!(parseFloat(form.targetValue) > 0) || !(autoUnit ?? form.unit.trim()))) ||
    (form.challengeType === "WEEKLY_HABIT" && !(parseInt(form.weeklyTarget) > 0)) ||
    (form.linkedType === "HABIT" && !form.linkedHabitId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (missing || saving) return
    setSaving(true)
    try {
      const ok = await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        challengeType: form.challengeType,
        startDate: form.startDate,
        endDate: form.endDate,
        targetValue: numeric ? form.targetValue.replace(",", ".") : periods.toString(),
        unit: numeric ? autoUnit ?? form.unit.trim() : form.challengeType === "WEEKLY_HABIT" ? "tygodni" : "miesięcy",
        weeklyTarget: form.challengeType === "WEEKLY_HABIT" ? form.weeklyTarget : "",
        color: form.color,
        isPublic: form.isPublic,
        linkedType: form.linkedType,
        linkedHabitId: form.linkedType === "HABIT" ? form.linkedHabitId : null,
        linkedSportTypeId: form.linkedType === "SPORT" ? form.linkedSportTypeId || null : null,
        linkedMetric: numeric ? form.linkedMetric : "COUNT",
      })
      if (ok) onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const segmented = "grid gap-1 rounded-lg bg-muted p-1"
  const segment = (active: boolean) =>
    cn("h-10 rounded-md px-1 text-sm font-medium transition-colors", active ? "bg-background shadow-sm" : "text-muted-foreground")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{challenge ? "Edytuj wyzwanie" : "Nowe wyzwanie"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="challenge-name">Nazwa</Label>
            <Input
              id="challenge-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="np. 20 treningów w listopadzie"
              className="h-11 text-base"
              autoFocus={!challenge && !idea}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Skąd liczyć postęp</Label>
            <div className={cn(segmented, "grid-cols-2 sm:grid-cols-4")}>
              {SOURCES.map((source) => (
                <button
                  key={source.value}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      linkedType: source.value,
                      linkedMetric: "COUNT",
                      linkedHabitId: source.value === "HABIT" ? f.linkedHabitId || habits[0]?.id || "" : "",
                    }))
                  }
                  className={segment(form.linkedType === source.value)}
                >
                  {source.label}
                </button>
              ))}
            </div>
            {form.linkedType === "NONE" && (
              <p className="text-xs text-muted-foreground">Postęp dodajesz ręcznie - np. odłożoną kwotę.</p>
            )}
            {form.linkedType === "HABIT" &&
              (habits.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">Najpierw dodaj nawyk w zakładce Nawyki.</p>
              ) : (
                <select
                  aria-label="Nawyk"
                  value={form.linkedHabitId}
                  onChange={(e) => setForm((f) => ({ ...f, linkedHabitId: e.target.value, linkedMetric: "COUNT" }))}
                  className={selectClass}
                >
                  {habits.map((habit) => (
                    <option key={habit.id} value={habit.id}>
                      {habit.name}
                    </option>
                  ))}
                </select>
              ))}
            {form.linkedType === "SPORT" && (
              <select
                aria-label="Aktywność"
                value={form.linkedSportTypeId}
                onChange={(e) => set("linkedSportTypeId", e.target.value)}
                className={selectClass}
              >
                <option value="">Każdy trening</option>
                {chips.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            )}
            {form.linkedType !== "NONE" && (
              <p className="text-xs text-muted-foreground">
                Nic nie odhaczasz drugi raz - wyzwanie samo policzy wpisy z okresu wyzwania.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Cel</Label>
            <div className={cn(segmented, "grid-cols-3")}>
              {TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  // The kind decides how the entries add up - fixed once the challenge has started
                  disabled={!!challenge && challenge.challengeType !== type.value}
                  onClick={() => set("challengeType", type.value)}
                  className={cn(segment(form.challengeType === type.value), "disabled:opacity-40")}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{TYPES.find((t) => t.value === form.challengeType)?.hint}</p>
          </div>

          {numeric && (form.linkedType === "HABIT" || form.linkedType === "SPORT") && (
            <div className="space-y-1.5">
              <Label>Co sumować</Label>
              <div className={cn(segmented, form.linkedType === "HABIT" && selectedHabit?.unit ? "grid-cols-3" : "grid-cols-2")}>
                <button type="button" onClick={() => set("linkedMetric", "COUNT")} className={segment(form.linkedMetric === "COUNT")}>
                  {form.linkedType === "SPORT" ? "Treningi" : "Dni"}
                </button>
                <button type="button" onClick={() => set("linkedMetric", "MINUTES")} className={segment(form.linkedMetric === "MINUTES")}>
                  Minuty
                </button>
                {form.linkedType === "HABIT" && selectedHabit?.unit && (
                  <button type="button" onClick={() => set("linkedMetric", "VALUE")} className={segment(form.linkedMetric === "VALUE")}>
                    {selectedHabit.unit}
                  </button>
                )}
              </div>
            </div>
          )}

          {numeric ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="challenge-target">Ile</Label>
                <Input
                  id="challenge-target"
                  type="text"
                  inputMode="decimal"
                  value={form.targetValue}
                  onChange={(e) => set("targetValue", e.target.value)}
                  placeholder="np. 20"
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="challenge-unit">Jednostka</Label>
                <Input
                  id="challenge-unit"
                  value={autoUnit ?? form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  disabled={autoUnit !== null}
                  placeholder="np. km, zł, stron"
                  className="h-11 text-base"
                />
              </div>
            </div>
          ) : form.challengeType === "WEEKLY_HABIT" ? (
            <div className="space-y-1.5">
              <Label htmlFor="challenge-weekly">Ile razy w tygodniu</Label>
              <Input
                id="challenge-weekly"
                type="number"
                inputMode="numeric"
                min={1}
                max={form.linkedType === "NONE" ? 7 : 21}
                value={form.weeklyTarget}
                onChange={(e) => set("weeklyTarget", e.target.value)}
                placeholder="np. 3"
                className="h-11 text-base"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="challenge-start">Od</Label>
                <Input
                  id="challenge-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="challenge-end">Do</Label>
                <Input
                  id="challenge-end"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => set("endDate", e.target.value)}
                  className="h-11 text-base"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Do końca miesiąca", end: monthEndKey(form.startDate || today) },
                { label: "30 dni", end: addDaysKey(form.startDate || today, 29) },
                { label: "90 dni", end: addDaysKey(form.startDate || today, 89) },
                { label: "Do końca roku", end: `${(form.startDate || today).slice(0, 4)}-12-31` },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => set("endDate", preset.end)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-xs transition-colors",
                    form.endDate === preset.end ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {!numeric && periods > 0 && (
              <p className="text-xs text-muted-foreground">
                Do zaliczenia: {periods} {form.challengeType === "WEEKLY_HABIT" ? "tyg." : "mies."}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Kolor</Label>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Kolor ${color}`}
                  onClick={() => set("color", color)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-transform",
                    form.color === color ? "scale-110 border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm">
              <span className="font-medium">Widoczne dla znajomych</span>
              <span className="block text-xs text-muted-foreground">Wyłączone - widzisz je tylko Ty</span>
            </span>
            <Switch checked={form.isPublic} onCheckedChange={(checked) => set("isPublic", checked)} />
          </label>

          <Button type="submit" className="h-11 w-full" disabled={missing || saving}>
            {challenge ? "Zapisz" : "Utwórz wyzwanie"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
