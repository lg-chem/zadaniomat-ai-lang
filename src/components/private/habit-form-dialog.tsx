"use client"

import { useEffect, useState } from "react"
import { Archive, Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { Habit, HabitInput } from "@/hooks/use-habits"
import type { HabitFrequency } from "@/lib/tracking"

export const HABIT_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#06b6d4", "#84cc16",
]

// Ready starts for an empty list - one tap fills the form
export const HABIT_IDEAS: { name: string; minutes?: number; unit?: string; frequency?: HabitFrequency; targetCount?: number }[] = [
  { name: "Czytanie", minutes: 30, unit: "stron" },
  { name: "Nauka hiszpańskiego", minutes: 20 },
  { name: "Medytacja", minutes: 10 },
  { name: "Rozciąganie", minutes: 15 },
  { name: "Gotowanie w domu", frequency: "WEEKLY", targetCount: 5 },
]

const RHYTHMS: { value: HabitFrequency; label: string }[] = [
  { value: "DAILY", label: "Codziennie" },
  { value: "WEEKLY", label: "W tygodniu" },
  { value: "MONTHLY", label: "W miesiącu" },
]

interface FormState {
  name: string
  frequency: HabitFrequency
  targetCount: number
  defaultMinutes: string
  unit: string
  scheduledTime: string
  color: string
  isPublic: boolean
}

function initialState(habit?: Habit | null, idea?: (typeof HABIT_IDEAS)[number] | null): FormState {
  if (habit) {
    return {
      name: habit.name,
      frequency: habit.frequency,
      targetCount: Math.max(1, habit.targetCount || 1),
      defaultMinutes: habit.defaultMinutes?.toString() ?? "",
      unit: habit.unit ?? "",
      scheduledTime: habit.scheduledTime ?? "",
      color: habit.color,
      isPublic: !!habit.isPublic,
    }
  }
  return {
    name: idea?.name ?? "",
    frequency: idea?.frequency ?? "DAILY",
    targetCount: idea?.targetCount ?? 3,
    defaultMinutes: idea?.minutes?.toString() ?? "",
    unit: idea?.unit ?? "",
    scheduledTime: "",
    color: HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)],
    // Private unless shared on purpose
    isPublic: false,
  }
}

interface HabitFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing this habit; none - a new one */
  habit?: Habit | null
  /** A new habit started from a ready idea */
  idea?: (typeof HABIT_IDEAS)[number] | null
  onSubmit: (input: HabitInput) => Promise<unknown> | void
  /** Stops the habit and keeps its history */
  onArchive?: () => void
  onDelete?: () => void
}

/** New habit / habit settings: rhythm, minutes, own unit, time in the plan of the day */
export function HabitFormDialog({ open, onOpenChange, habit, idea, onSubmit, onArchive, onDelete }: HabitFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(habit, idea))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(initialState(habit, idea))
  }, [open, habit, idea])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const maxTarget = form.frequency === "WEEKLY" ? 7 : 31

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      await onSubmit({
        name: form.name.trim(),
        frequency: form.frequency,
        targetCount: form.frequency === "DAILY" ? 1 : Math.min(maxTarget, Math.max(1, form.targetCount)),
        defaultMinutes: form.defaultMinutes ? parseInt(form.defaultMinutes) || null : null,
        unit: form.unit.trim() || null,
        scheduledTime: form.scheduledTime || null,
        color: form.color,
        categoryId: habit?.categoryId ?? null,
        isPublic: form.isPublic,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{habit ? "Ustawienia nawyku" : "Nowy nawyk"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Nazwa</Label>
            <Input
              id="habit-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="np. Czytanie"
              className="h-11 text-base"
              autoFocus={!habit && !idea}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Jak często</Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {RHYTHMS.map((rhythm) => (
                <button
                  key={rhythm.value}
                  type="button"
                  onClick={() => set("frequency", rhythm.value)}
                  className={cn(
                    "h-10 rounded-md text-sm font-medium transition-colors",
                    form.frequency === rhythm.value ? "bg-background shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {rhythm.label}
                </button>
              ))}
            </div>
            {form.frequency !== "DAILY" && (
              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => set("targetCount", Math.max(1, form.targetCount - 1))}
                  aria-label="Mniej razy"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="min-w-[7rem] text-center text-sm">
                  <span className="text-xl font-bold tabular-nums">{Math.min(maxTarget, form.targetCount)}</span>{" "}
                  {form.frequency === "WEEKLY" ? "× w tygodniu" : "× w miesiącu"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => set("targetCount", Math.min(maxTarget, form.targetCount + 1))}
                  aria-label="Więcej razy"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="habit-minutes">Zwykle trwa (min)</Label>
              <Input
                id="habit-minutes"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.defaultMinutes}
                onChange={(e) => set("defaultMinutes", e.target.value)}
                placeholder="np. 30"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="habit-time">Godzina w planie</Label>
              <Input
                id="habit-time"
                type="time"
                value={form.scheduledTime}
                onChange={(e) => set("scheduledTime", e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="habit-unit">Co jeszcze liczyć (opcjonalnie)</Label>
            <Input
              id="habit-unit"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="np. stron, lekcji, km"
              maxLength={20}
              className="h-11 text-base"
            />
            <p className="text-xs text-muted-foreground">
              Wpisane - przy odhaczaniu podasz liczbę (np. ile stron). Puste - wystarczy odhaczyć.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Kolor</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_COLORS.map((color) => (
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
              <span className="font-medium">Widoczny dla znajomych</span>
              <span className="block text-xs text-muted-foreground">Wyłączone - widzisz go tylko Ty</span>
            </span>
            <Switch checked={form.isPublic} onCheckedChange={(checked) => set("isPublic", checked)} />
          </label>

          <Button type="submit" className="h-11 w-full" disabled={!form.name.trim() || saving}>
            {habit ? "Zapisz" : "Dodaj nawyk"}
          </Button>

          {habit && (onArchive || onDelete) && (
            <div className="flex gap-2 border-t pt-3">
              {onArchive && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 flex-1 text-muted-foreground"
                  onClick={() => {
                    onArchive()
                    onOpenChange(false)
                  }}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Zakończ nawyk
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 flex-1 text-destructive hover:text-destructive"
                  onClick={() => {
                    onDelete()
                    onOpenChange(false)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Usuń z historią
                </Button>
              )}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
