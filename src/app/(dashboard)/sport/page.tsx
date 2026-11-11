"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Clock, Dumbbell, Footprints, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  BODY_PARTS,
  useSportActivities,
  useSportTypes,
  useSteps,
  type SportActivity,
  type StepsEntry,
} from "@/hooks/use-sport"
import { jsonRequest } from "@/lib/pending-writes"
import { refreshPrivate } from "@/lib/private-sync"
import { addDaysKey, dateOfKey, dayKeyOf, formatMinutes, todayKey, weekStartKey } from "@/lib/tracking"
import { SportQuickLog } from "@/components/private/sport-quick-log"
import { ActivityDialog, type ActivityDialogTarget, type ActivityFormValues } from "@/components/private/activity-dialog"

interface DayRowProps {
  day: string
  today: string
  activities: SportActivity[]
  steps?: StepsEntry
  onOpen: (target: ActivityDialogTarget) => void
  onSaveSteps: (day: string, count: number) => void
  onCopySteps: (entry: StepsEntry) => void
}

/** One day of the week: its workouts (tap to change), steps, and adding a workout to that day */
const DayRow = memo(function DayRow({ day, today, activities, steps, onOpen, onSaveSteps, onCopySteps }: DayRowProps) {
  const [editingSteps, setEditingSteps] = useState(false)
  const [value, setValue] = useState("")
  const date = dateOfKey(day)
  const future = day > today

  const commit = () => {
    setEditingSteps(false)
    const count = parseInt(value.replace(/\s/g, ""))
    if (!Number.isFinite(count) || count < 0 || count === steps?.count) return
    onSaveSteps(day, count)
  }

  return (
    <div className={cn("flex gap-3 p-3", day === today && "bg-private/5")}>
      <div className="w-10 flex-shrink-0 pt-1 text-center">
        <div className={cn("text-[11px] uppercase text-muted-foreground", day === today && "font-semibold text-private")}>
          {format(date, "EEEEEE", { locale: pl })}
        </div>
        <div className={cn("text-lg font-bold leading-tight tabular-nums", day === today && "text-private")}>{format(date, "d")}</div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {activities.map((activity) => (
          <button
            key={activity.id}
            type="button"
            onClick={() => onOpen({ mode: "edit", activity })}
            // Being saved - it opens once it has its id
            disabled={activity.id.startsWith("temp-")}
            className="flex min-h-[2.75rem] w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-white transition-opacity active:opacity-80 disabled:opacity-70"
            style={{ backgroundColor: activity.type.color }}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{activity.type.name}</span>
                {activity.isPublic && <Users className="h-3 w-3 flex-shrink-0 opacity-80" aria-label="Widoczny dla znajomych" />}
              </span>
              {(activity.bodyParts.length > 0 || activity.notes) && (
                <span className="block truncate text-xs opacity-90">
                  {activity.fromSteps && activity.notes
                    ? `${parseInt(activity.notes).toLocaleString("pl-PL")} kroków`
                    : [activity.bodyParts.map((p) => p.name).join(", "), activity.notes].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            {activity.duration ? (
              <span className="flex flex-shrink-0 items-center gap-1 text-xs opacity-90">
                <Clock className="h-3 w-3" />
                {formatMinutes(activity.duration)}
              </span>
            ) : null}
          </button>
        ))}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {editingSteps ? (
            <Input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit()
                if (e.key === "Escape") setEditingSteps(false)
              }}
              placeholder="liczba kroków"
              className="h-10 w-36 text-base"
              autoFocus
            />
          ) : (
            <button
              type="button"
              disabled={future}
              onClick={() => {
                setValue(steps ? steps.count.toString() : "")
                setEditingSteps(true)
              }}
              className="flex h-10 items-center gap-1.5 rounded-md pr-2 text-muted-foreground transition-colors active:bg-accent disabled:opacity-40 md:hover:text-foreground"
            >
              <Footprints className="h-4 w-4" />
              {steps ? (
                <span className="font-medium tabular-nums text-foreground">{steps.count.toLocaleString("pl-PL")}</span>
              ) : (
                "kroki"
              )}
            </button>
          )}
          {steps && !steps.copiedToActivity && !steps.id.startsWith("temp-") && !editingSteps && (
            <button
              type="button"
              onClick={() => onCopySteps(steps)}
              className="h-10 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              dodaj jako aktywność
            </button>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 flex-shrink-0 text-muted-foreground"
        disabled={future}
        onClick={() => onOpen({ mode: "new", day })}
        aria-label={`Dodaj trening: ${format(date, "EEEE d MMMM", { locale: pl })}`}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  )
})

export default function SportPage() {
  const today = todayKey()
  const [weekStart, setWeekStart] = useState(() => weekStartKey(today))
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i)), [weekStart])
  const isThisWeek = weekStart === weekStartKey(today)
  const range = useMemo(() => ({ from: weekStart, to: days[6] }), [weekStart, days])

  const { types, isLoading: typesLoading, createType } = useSportTypes()
  const { activities, isLoading: activitiesLoading, addActivity, updateActivity, removeActivity } = useSportActivities(range)
  const { steps, saveSteps } = useSteps(range)
  const [dialog, setDialog] = useState<ActivityDialogTarget | null>(null)

  const isLoading = (typesLoading && types.length === 0) || (activitiesLoading && activities.length === 0)

  const byDay = useMemo(() => {
    const map = new Map<string, SportActivity[]>()
    for (const activity of activities) {
      const day = dayKeyOf(activity.date)
      const list = map.get(day)
      if (list) list.push(activity)
      else map.set(day, [activity])
    }
    return map
  }, [activities])
  const stepsByDay = useMemo(() => new Map(steps.map((s) => [dayKeyOf(s.date), s])), [steps])

  // Week summary - workouts without the walks copied from the steps
  const summary = useMemo(() => {
    const workouts = activities.filter((a) => !a.fromSteps)
    const bodyParts: Record<string, number> = {}
    for (const activity of workouts) {
      for (const part of activity.bodyParts) bodyParts[part.name] = (bodyParts[part.name] || 0) + 1
    }
    return {
      count: workouts.length,
      minutes: workouts.reduce((sum, a) => sum + (a.duration ?? 0), 0),
      activeDays: new Set(workouts.map((a) => dayKeyOf(a.date))).size,
      steps: steps.reduce((sum, s) => sum + s.count, 0),
      bodyParts,
    }
  }, [activities, steps])

  const handleSave = useCallback(
    (values: ActivityFormValues, activityId?: string) => {
      if (activityId) updateActivity(activityId, values)
      else addActivity(values)
    },
    [addActivity, updateActivity]
  )
  const handleSaveSteps = useCallback((day: string, count: number) => saveSteps(day, count), [saveSteps])
  const handleCopySteps = useCallback(async (entry: StepsEntry) => {
    try {
      await jsonRequest(`/api/sport/steps/${entry.id}/copy-to-activity`, "POST", {})
      refreshPrivate("sport", "steps")
      toast.success("Kroki dodane jako aktywność")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się skopiować kroków")
    }
  }, [])

  // Quick logging goes to today (or, in another week, to the form with a day to pick)
  const quickDay = isThisWeek ? today : days[6]
  const hasBodyParts = Object.keys(summary.bodyParts).length > 0

  return (
    <div className="mx-auto max-w-4xl space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Sport</h1>
          <p className="text-sm text-muted-foreground">Treningi i kroki tydzień po tygodniu</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setWeekStart((w) => addDaysKey(w, -7))} aria-label="Poprzedni tydzień">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 px-2 text-center text-sm font-medium sm:min-w-[11rem]">
            {format(dateOfKey(weekStart), "d MMM", { locale: pl })} – {format(dateOfKey(days[6]), "d MMM yyyy", { locale: pl })}
          </div>
          {!isThisWeek && (
            <Button variant="outline" className="h-11 px-3" onClick={() => setWeekStart(weekStartKey(today))}>
              Ten tydzień
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            disabled={isThisWeek}
            onClick={() => setWeekStart((w) => addDaysKey(w, 7))}
            aria-label="Następny tydzień"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Treningi</div>
              <div className="text-xl font-bold tabular-nums">{summary.count}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Aktywne dni</div>
              <div className="text-xl font-bold tabular-nums">{summary.activeDays}/7</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Czas</div>
              <div className="text-xl font-bold tabular-nums">{summary.minutes ? formatMinutes(summary.minutes) : "–"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Kroki</div>
              <div className="text-xl font-bold tabular-nums">{summary.steps ? summary.steps.toLocaleString("pl-PL") : "–"}</div>
            </div>
          </div>
          {hasBodyParts && (
            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">Partie w tym tygodniu</div>
              <div className="flex flex-wrap gap-1.5">
                {BODY_PARTS.map((part) => {
                  const count = summary.bodyParts[part] || 0
                  return (
                    <span
                      key={part}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs",
                        count > 0 ? "bg-private/10 font-medium text-private" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {part}
                      {count > 0 && ` ×${count}`}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isThisWeek && (
        <Card>
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="h-4 w-4 text-private" />
              Dodaj dzisiejszy trening
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <SportQuickLog
              day={quickDay}
              types={types}
              activities={[]}
              onAdd={addActivity}
              onOpen={setDialog}
              onCreateType={createType}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {days.map((day) => (
                <DayRow
                  key={day}
                  day={day}
                  today={today}
                  activities={byDay.get(day) ?? EMPTY}
                  steps={stepsByDay.get(day)}
                  onOpen={setDialog}
                  onSaveSteps={handleSaveSteps}
                  onCopySteps={handleCopySteps}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ActivityDialog target={dialog} types={types} onClose={() => setDialog(null)} onSave={handleSave} onDelete={removeActivity} />
    </div>
  )
}

// One list for every day without workouts - the rows of those days are not rendered again
const EMPTY: SportActivity[] = []
