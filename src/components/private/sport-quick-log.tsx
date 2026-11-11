"use client"

import { memo, useState } from "react"
import { Clock, Plus } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { ActivityInput, SportActivity, SportActivityType } from "@/hooks/use-sport"
import type { ActivityDialogTarget } from "@/components/private/activity-dialog"
import { formatMinutes } from "@/lib/tracking"

interface SportQuickLogProps {
  /** The day the taps log to (yyyy-MM-dd) */
  day: string
  types: SportActivityType[]
  /** Workouts of that day */
  activities: SportActivity[]
  onAdd: (input: ActivityInput) => void
  /** Opens the workout form (new with details, or an existing one) */
  onOpen: (target: ActivityDialogTarget) => void
  onCreateType: (name: string) => Promise<unknown>
}

/**
 * Logging a workout in one tap: a chip per activity type. Gym opens the form
 * (muscle groups are the point there); the rest is saved at once and can be
 * filled in later by tapping it on the list.
 */
export const SportQuickLog = memo(function SportQuickLog({
  day,
  types,
  activities,
  onAdd,
  onOpen,
  onCreateType,
}: SportQuickLogProps) {
  const [addingType, setAddingType] = useState(false)
  const [typeName, setTypeName] = useState("")
  // "Kroki" is the type of walks copied from the steps - not something to log by hand
  const chips = types.filter((t) => t.name !== "Kroki")
  const listed = activities.filter((a) => !a.fromSteps)

  const handleChip = (type: SportActivityType) => {
    if (type.hasBodyParts) onOpen({ mode: "new", day, type })
    else onAdd({ type, day })
  }

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = typeName.trim()
    if (!name) return
    try {
      await onCreateType(name)
      setTypeName("")
      setAddingType(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać typu")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chips.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => handleChip(type)}
            className="flex h-11 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium transition-colors active:bg-accent md:hover:bg-accent/60"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color }} />
            {type.name}
          </button>
        ))}
        {!addingType && (
          <button
            type="button"
            onClick={() => setAddingType(true)}
            className="flex h-11 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm text-muted-foreground transition-colors active:bg-accent md:hover:bg-accent/60"
          >
            <Plus className="h-4 w-4" />
            Inna
          </button>
        )}
      </div>

      {addingType && (
        <form onSubmit={handleCreateType} className="flex gap-2">
          <Input
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            placeholder="np. Tańce, Ścianka, Joga"
            className="h-11 text-base"
            autoFocus
          />
          <Button type="submit" className="h-11" disabled={!typeName.trim()}>
            Dodaj
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={() => setAddingType(false)}>
            Anuluj
          </Button>
        </form>
      )}

      {listed.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {listed.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                onClick={() => onOpen({ mode: "edit", activity })}
                // Being saved - it opens once it has its id
                disabled={activity.id.startsWith("temp-")}
                className="flex min-h-[3rem] w-full items-center gap-3 px-3 py-2 text-left transition-colors active:bg-accent disabled:opacity-70 md:hover:bg-accent/60"
              >
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: activity.type.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{activity.type.name}</span>
                  {(activity.bodyParts.length > 0 || activity.notes) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {[activity.bodyParts.map((p) => p.name).join(", "), activity.notes].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                {activity.duration ? (
                  <span className="flex flex-shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatMinutes(activity.duration)}
                  </span>
                ) : (
                  <span className="flex-shrink-0 text-xs text-muted-foreground">dodaj szczegóły</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
