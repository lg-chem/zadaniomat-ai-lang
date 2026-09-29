"use client"

import { useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDayLong } from "@/lib/calendar"
import { cn } from "@/lib/utils"
import { ItemChip } from "./item-chip"
import { isDraggable, type CalendarItem, type DayItems } from "./items"
import type { MoveTarget } from "./time-grid"

const WEEKDAYS = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"]
const VISIBLE_ITEMS = 3

interface MonthViewProps {
  days: string[] // full weeks, Monday first
  month: string // "yyyy-MM" of the displayed month
  today: string
  items: Map<string, DayItems>
  onCreate: (day: string) => void
  onItemClick: (item: CalendarItem) => void
  onItemMove: (item: CalendarItem, target: MoveTarget) => void
  onDayClick: (day: string) => void
}

export function MonthView({ days, month, today, items, onCreate, onItemClick, onItemMove, onDayClick }: MonthViewProps) {
  const draggedRef = useRef<CalendarItem | null>(null)
  const [dropDay, setDropDay] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const weeks = days.length / 7

  const chip = (item: CalendarItem, inPopover = false) => (
    <ItemChip
      key={item.key}
      item={item}
      showTime
      draggable={!inPopover && isDraggable(item)}
      onDragStart={(e) => {
        draggedRef.current = item
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", item.title)
      }}
      onDragEnd={() => {
        draggedRef.current = null
        setDropDay(null)
      }}
      onClick={(e) => {
        e.stopPropagation()
        setOpenDay(null)
        onItemClick(item)
      }}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
      <div className="grid shrink-0 grid-cols-7 border-b">
        {WEEKDAYS.map((name) => (
          <div key={name} className="py-2 text-center text-[11px] font-medium uppercase text-muted-foreground">
            {name}
          </div>
        ))}
      </div>

      <div
        className="grid flex-1 grid-cols-7 overflow-y-auto"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(112px, 1fr))` }}
      >
        {days.map((day, index) => {
          const dayItems = items.get(day)
          const list = dayItems ? [...dayItems.allDay, ...dayItems.timed] : []
          const visible = list.slice(0, list.length > VISIBLE_ITEMS + 1 ? VISIBLE_ITEMS : VISIBLE_ITEMS + 1)
          const hidden = list.length - visible.length
          const isToday = day === today
          const outside = !day.startsWith(month)

          return (
            <div
              key={day}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 overflow-hidden border-b border-l p-0.5 transition-colors sm:p-1",
                index % 7 === 0 && "border-l-0",
                outside && "bg-muted/30",
                dropDay === day && "bg-blue-500/10"
              )}
              onClick={() => onCreate(day)}
              onDragOver={(e) => {
                if (!draggedRef.current) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                if (dropDay !== day) setDropDay(day)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropDay((d) => (d === day ? null : d))
              }}
              onDrop={(e) => {
                e.preventDefault()
                const item = draggedRef.current
                draggedRef.current = null
                setDropDay(null)
                if (item && item.day !== day) {
                  onItemMove(item, { day, allDay: item.allDay, start: item.start, end: item.end })
                }
              }}
            >
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDayClick(day)
                  }}
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium",
                    isToday ? "bg-blue-600 text-white" : outside ? "text-muted-foreground hover:bg-muted" : "hover:bg-muted"
                  )}
                  title={formatDayLong(day)}
                >
                  {Number(day.slice(8, 10)) === 1 && !isToday
                    ? `1 ${new Date(`${day}T12:00:00`).toLocaleDateString("pl-PL", { month: "short" })}`
                    : Number(day.slice(8, 10))}
                </button>
              </div>

              {visible.map((item) => chip(item))}

              {hidden > 0 && (
                <Popover open={openDay === day} onOpenChange={(open) => setOpenDay(open ? day : null)}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded px-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted"
                    >
                      +{hidden} więcej
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-1 p-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="mb-1 w-full text-center text-sm font-medium hover:underline"
                      onClick={() => {
                        setOpenDay(null)
                        onDayClick(day)
                      }}
                    >
                      {formatDayLong(day)}
                    </button>
                    {list.map((item) => chip(item, true))}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
