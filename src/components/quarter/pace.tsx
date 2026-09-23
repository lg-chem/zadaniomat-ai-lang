import { cn } from "@/lib/utils"
import { PACE_LABELS, type PaceStatus } from "@/lib/quarters"

export const PACE_BAR_CLASSES: Record<PaceStatus, string> = {
  done: "bg-emerald-500",
  not_started: "bg-primary",
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  off_track: "bg-red-500",
}

const PACE_BADGE_CLASSES: Record<PaceStatus, string> = {
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  not_started: "bg-secondary text-secondary-foreground",
  on_track: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  at_risk: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  off_track: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
}

const PACE_DOT_CLASSES: Record<PaceStatus, string> = {
  done: "bg-emerald-500",
  not_started: "bg-muted-foreground/50",
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  off_track: "bg-red-500",
}

export function PaceBadge({ status, className }: { status: PaceStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        PACE_BADGE_CLASSES[status],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", PACE_DOT_CLASSES[status])} />
      {PACE_LABELS[status]}
    </span>
  )
}

/** Progress bar with a marker where the value should be today */
export function PaceBar({
  progress,
  expected,
  status,
  className,
}: {
  progress: number
  expected: number | null
  status: PaceStatus
  className?: string
}) {
  return (
    <div className={cn("relative h-2 w-full rounded-full bg-secondary", className)}>
      <div
        className={cn("h-full rounded-full transition-all", PACE_BAR_CLASSES[status])}
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
      {expected !== null && expected > 0 && expected < 1 && (
        <div
          className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground/60"
          style={{ left: `calc(${expected * 100}% - 1px)` }}
          title="Gdzie powinieneś być dziś"
        />
      )}
    </div>
  )
}
