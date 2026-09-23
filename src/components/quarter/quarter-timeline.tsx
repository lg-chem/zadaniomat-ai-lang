"use client"

import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Check, Flag } from "lucide-react"
import { cn } from "@/lib/utils"
import { addDaysToKey, daysBetween, dayKeyToLocalDate, type QuarterPayload } from "@/lib/quarters"

const shortDate = (key: string) => format(dayKeyToLocalDate(key), "d MMM", { locale: pl })

/** Quarter strip: 6 sprints + review week, with today's position */
export function QuarterTimeline({
  quarter,
  today,
  selectedSprintId,
  onSelectSprint,
}: {
  quarter: QuarterPayload
  today: string
  selectedSprintId: string | null
  onSelectSprint: (sprintId: string) => void
}) {
  const lastSprint = quarter.sprints[quarter.sprints.length - 1]
  const reviewDays = lastSprint ? daysBetween(lastSprint.endKey, quarter.endKey) : 0
  const inReview = lastSprint ? today > lastSprint.endKey && today <= quarter.endKey : false

  return (
    <div>
      <div className="flex gap-1">
        {quarter.sprints.map((sprint) => {
          const isCurrent = sprint.startKey <= today && today <= sprint.endKey
          const isPast = sprint.endKey < today
          const isSelected = sprint.id === selectedSprintId
          const days = daysBetween(sprint.startKey, sprint.endKey) + 1

          return (
            <button
              key={sprint.id}
              type="button"
              onClick={() => onSelectSprint(sprint.id)}
              style={{ flexGrow: days, flexBasis: 0 }}
              className={cn(
                "relative min-w-0 overflow-hidden rounded-md border px-1.5 py-2 text-left transition-colors sm:px-2",
                isCurrent ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/60",
                isPast && !isCurrent && "text-muted-foreground",
                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
              )}
              aria-pressed={isSelected}
              aria-label={`${sprint.name}, ${shortDate(sprint.startKey)} – ${shortDate(sprint.endKey)}`}
            >
              <div className="flex items-center gap-1 text-xs font-semibold sm:text-sm">
                <span className="sm:hidden">S{sprint.number}</span>
                <span className="hidden truncate sm:inline">{sprint.name}</span>
                {sprint.closedAt ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="zamknięty" />
                ) : sprint.plannedAt ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="zaplanowany" />
                ) : null}
              </div>
              <div className="hidden truncate text-[11px] text-muted-foreground md:block">
                {shortDate(sprint.startKey)} – {shortDate(sprint.endKey)}
              </div>
              {isCurrent && (
                // How much of the running sprint has passed
                <div
                  className="absolute bottom-0 left-0 h-1 bg-primary"
                  style={{ width: `${((daysBetween(sprint.startKey, today) + 1) / days) * 100}%` }}
                />
              )}
            </button>
          )
        })}
        {reviewDays > 0 && (
          <div
            style={{ flexGrow: reviewDays, flexBasis: 0 }}
            className={cn(
              "flex min-w-0 flex-col justify-center rounded-md border border-dashed px-1.5 py-2 sm:px-2",
              inReview && "border-primary bg-primary/10"
            )}
            title={`Przegląd kwartału: ${shortDate(addDaysToKey(lastSprint.endKey, 1))} – ${shortDate(quarter.endKey)}`}
          >
            <Flag className={cn("h-3.5 w-3.5", quarter.reviewedAt ? "text-emerald-600" : "text-muted-foreground")} />
            <span className="hidden truncate text-[11px] text-muted-foreground md:block">Przegląd</span>
          </div>
        )}
      </div>
    </div>
  )
}
