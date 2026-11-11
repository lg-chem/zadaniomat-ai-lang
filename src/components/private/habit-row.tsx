"use client"

import { memo } from "react"
import { Check, Clock, Flame, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { completionOn, type Habit } from "@/hooks/use-habits"
import { formatStreak, formatMinutes } from "@/lib/tracking"

interface HabitRowProps {
  habit: Habit
  /** The day being ticked (yyyy-MM-dd) */
  day: string
  /** The day is the running one - "this week 2/3" and the streak refer to it */
  isToday: boolean
  onToggle: (habit: Habit, day: string) => void
  onDetails: (habit: Habit, day: string) => void
}

/**
 * A habit on one day: the whole row is the tick (a thumb-sized target), the button
 * on the right opens the day's details (minutes, count, note).
 */
export const HabitRow = memo(function HabitRow({ habit, day, isToday, onToggle, onDetails }: HabitRowProps) {
  const completion = completionOn(habit, day)
  const done = !!completion
  const periodic = habit.frequency !== "DAILY"
  const periodMet = periodic && habit.periodDone >= habit.periodTarget

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={() => onToggle(habit, day)}
        aria-pressed={done}
        className="flex min-h-[3.5rem] flex-1 items-center gap-3 rounded-l-lg px-2 py-2 text-left transition-colors active:bg-accent md:hover:bg-accent/60"
      >
        <span
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            done ? "border-transparent text-white" : "border-muted-foreground/30"
          )}
          style={done ? { backgroundColor: habit.color } : { borderColor: `${habit.color}80` }}
        >
          {done && <Check className="h-5 w-5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-medium", done && "text-muted-foreground line-through decoration-1")}>
            {habit.name}
          </span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            {habit.scheduledTime && <span className="tabular-nums">{habit.scheduledTime}</span>}
            {habit.currentStreak > 0 && (
              <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
                <Flame className="h-3.5 w-3.5" />
                {formatStreak(habit.currentStreak, habit.frequency)}
              </span>
            )}
            {periodic && isToday && (
              <span className={cn(periodMet && "text-green-600 dark:text-green-400")}>
                {habit.periodDone}/{habit.periodTarget} {habit.frequency === "WEEKLY" ? "w tym tyg." : "w tym mies."}
              </span>
            )}
            {done && habit.unit && (
              <span>
                {completion.count} {habit.unit}
              </span>
            )}
            {done && completion.minutes ? (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {formatMinutes(completion.minutes)}
              </span>
            ) : (
              !done && habit.defaultMinutes ? <span>{formatMinutes(habit.defaultMinutes)}</span> : null
            )}
            {done && completion.notes && <span className="truncate">{completion.notes}</span>}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDetails(habit, day)}
        aria-label={`Szczegóły: ${habit.name}`}
        className="flex w-12 flex-shrink-0 items-center justify-center rounded-r-lg text-muted-foreground transition-colors active:bg-accent md:hover:bg-accent/60"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </div>
  )
})
