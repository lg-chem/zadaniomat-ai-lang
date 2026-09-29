"use client"

import { forwardRef, type HTMLAttributes } from "react"
import { CheckCircle2, Circle, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import { readableTextColor, withAlpha } from "./color"
import { formatMinutes, type CalendarItem } from "./items"

interface ItemChipProps extends HTMLAttributes<HTMLDivElement> {
  item: CalendarItem
  // Month view shows the start time of timed items
  showTime?: boolean
  dimmed?: boolean
}

// One line entry for the all-day row and the month grid
export const ItemChip = forwardRef<HTMLDivElement, ItemChipProps>(function ItemChip(
  { item, showTime, dimmed, className, style, ...props },
  ref
) {
  const base = "flex h-[22px] w-full min-w-0 items-center gap-1 overflow-hidden rounded px-1 text-xs leading-none select-none sm:px-1.5"

  if (item.kind === "event" && item.allDay) {
    return (
      <div
        ref={ref}
        className={cn(base, "font-medium cursor-pointer hover:brightness-95", dimmed && "opacity-40", className)}
        style={{ backgroundColor: item.color, color: readableTextColor(item.color), ...style }}
        title={item.title}
        {...props}
      >
        <span className="truncate">{item.title}</span>
      </div>
    )
  }

  if (item.kind === "event") {
    return (
      <div
        ref={ref}
        className={cn(base, "cursor-pointer hover:bg-muted", dimmed && "opacity-40", className)}
        style={style}
        title={`${formatMinutes(item.start)} ${item.title}`}
        {...props}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        {showTime && <span className="hidden shrink-0 text-muted-foreground sm:inline">{formatMinutes(item.start)}</span>}
        <span className="truncate font-medium">{item.title}</span>
      </div>
    )
  }

  if (item.kind === "task") {
    const done = item.task.status === "COMPLETED"
    const Icon = done ? CheckCircle2 : Circle
    return (
      <div
        ref={ref}
        className={cn(
          base,
          "cursor-pointer border bg-background hover:bg-muted",
          done && "opacity-60",
          dimmed && "opacity-40",
          className
        )}
        style={{ borderLeft: `3px solid ${item.color}`, ...style }}
        title={item.title}
        {...props}
      >
        <Icon className="h-3 w-3 shrink-0" style={{ color: item.color }} />
        {showTime && !item.allDay && <span className="hidden shrink-0 text-muted-foreground sm:inline">{formatMinutes(item.start)}</span>}
        <span className={cn("truncate", done && "line-through")}>{item.title}</span>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(base, "cursor-pointer italic text-muted-foreground hover:bg-muted", dimmed && "opacity-40", className)}
      style={{ border: `1px dashed ${withAlpha(item.color, 0.7)}`, ...style }}
      title={`${item.title} (zadanie cykliczne)`}
      {...props}
    >
      <Repeat className="h-3 w-3 shrink-0" style={{ color: item.color }} />
      {showTime && !item.allDay && <span className="hidden shrink-0 sm:inline">{formatMinutes(item.start)}</span>}
      <span className="truncate">{item.title}</span>
    </div>
  )
})
