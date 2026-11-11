"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { completionOn, sortHabitsForDay, useHabits, type DayChange, type Habit } from "@/hooks/use-habits"
import { weekRange } from "@/hooks/use-sport"
import { todayKey } from "@/lib/tracking"
import { HabitRow } from "@/components/private/habit-row"
import { HabitDayDialog } from "@/components/private/habit-day-dialog"

/**
 * Habits in the plan of a day (private schedule): the timed ones by their hour,
 * ticked right there. Days ahead only list them - there is nothing to tick yet.
 */
export function DayHabitsCard({ date }: { date: string }) {
  const today = todayKey()
  const { habits, setDay } = useHabits(weekRange(date))
  const [details, setDetails] = useState<{ habit: Habit; day: string } | null>(null)
  const future = date > today

  const sorted = useMemo(() => sortHabitsForDay(habits), [habits])
  const doneCount = sorted.filter((habit) => completionOn(habit, date)).length

  const handleToggle = useCallback(
    (habit: Habit, day: string) => {
      if (day > todayKey()) return
      // A habit counted in its own unit asks "how much" - a plain one is just ticked
      if (habit.unit) setDetails({ habit, day })
      else setDay(habit.id, day)
    },
    [setDay]
  )
  const handleDetails = useCallback((habit: Habit, day: string) => {
    if (day <= todayKey()) setDetails({ habit, day })
  }, [])
  const handleSave = useCallback((habitId: string, day: string, change: DayChange) => setDay(habitId, day, change), [setDay])

  if (sorted.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Repeat className="h-5 w-5" />
          Nawyki
          {!future && (
            <span className="text-sm font-normal tabular-nums text-muted-foreground">
              {doneCount}/{sorted.length}
            </span>
          )}
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-10 px-3 text-muted-foreground">
          <Link href="/habits" prefetch={false}>
            Tydzień
          </Link>
        </Button>
      </CardHeader>
      <CardContent className={future ? "px-2 pb-2 opacity-60" : "px-2 pb-2"}>
        <div className="divide-y divide-border/60">
          {sorted.map((habit) => (
            <HabitRow key={habit.id} habit={habit} day={date} isToday={date === today} onToggle={handleToggle} onDetails={handleDetails} />
          ))}
        </div>
      </CardContent>
      <HabitDayDialog target={details} onClose={() => setDetails(null)} onSave={handleSave} />
    </Card>
  )
}
