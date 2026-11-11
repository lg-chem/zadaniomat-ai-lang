"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { completionOn, type DayChange, type Habit } from "@/hooks/use-habits"
import { dateOfKey } from "@/lib/tracking"

const MINUTE_CHIPS = [10, 15, 20, 30, 45, 60, 90]

interface HabitDayDialogProps {
  /** The habit and the day being filled in; null - closed */
  target: { habit: Habit; day: string } | null
  onClose: () => void
  onSave: (habitId: string, day: string, change: DayChange) => void
  /** Opens the habit's settings (rhythm, unit, time in the plan) */
  onSettings?: (habit: Habit) => void
}

/** One day of a habit: how long, how much (own unit), a note - or unticking the day */
export function HabitDayDialog({ target, onClose, onSave, onSettings }: HabitDayDialogProps) {
  const [minutes, setMinutes] = useState("")
  const [count, setCount] = useState("")
  const [notes, setNotes] = useState("")

  const habit = target?.habit
  const day = target?.day
  const completion = habit && day ? completionOn(habit, day) : undefined

  useEffect(() => {
    if (!habit || !day) return
    const existing = completionOn(habit, day)
    setMinutes((existing ? existing.minutes : habit.defaultMinutes)?.toString() ?? "")
    setCount(existing && habit.unit ? existing.count.toString() : "")
    setNotes(existing?.notes ?? "")
    // Filled once per opening - a refresh of the list in the background doesn't wipe what's being typed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit?.id, day])

  if (!habit || !day) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(habit.id, day, {
      done: true,
      minutes: minutes ? parseInt(minutes) || null : null,
      ...(habit.unit && { count: Math.max(1, parseInt(count) || 1) }),
      notes: notes.trim() || null,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-sm"
        // The keyboard comes up only when a number has to be typed (own unit) - the
        // minutes usually come from the chips or stay as they are
        onOpenAutoFocus={(e) => {
          if (!habit.unit) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
            {habit.name}
          </DialogTitle>
          <DialogDescription>{format(dateOfKey(day), "EEEE, d MMMM", { locale: pl })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          {habit.unit && (
            <div className="space-y-1.5">
              <Label htmlFor="habit-day-count">Ile ({habit.unit})</Label>
              <Input
                id="habit-day-count"
                type="number"
                inputMode="numeric"
                min={1}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder={`np. 20 ${habit.unit}`}
                className="h-12 text-lg"
                autoFocus
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="habit-day-minutes">Czas (min)</Label>
            <Input
              id="habit-day-minutes"
              type="number"
              inputMode="numeric"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="bez czasu"
              className="h-12 text-lg"
            />
            <div className="flex flex-wrap gap-1.5">
              {MINUTE_CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMinutes(value.toString())}
                  className={cn(
                    "h-9 min-w-[2.75rem] rounded-full border px-2 text-sm tabular-nums transition-colors",
                    minutes === value.toString() ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="habit-day-notes">Notatka</Label>
            <Input
              id="habit-day-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="np. rozdział 4, lekcja 12"
              className="h-11 text-base"
            />
          </div>

          <div className="flex gap-2">
            {completion && (
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => {
                  onSave(habit.id, day, { done: false })
                  onClose()
                }}
              >
                Odznacz
              </Button>
            )}
            <Button type="submit" className="h-11 flex-1">
              {completion ? "Zapisz" : "Zrobione"}
            </Button>
          </div>
          {onSettings && (
            <Button type="button" variant="ghost" className="h-10 w-full text-muted-foreground" onClick={() => onSettings(habit)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Ustawienia nawyku
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
