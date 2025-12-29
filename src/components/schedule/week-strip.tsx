"use client"

import { useMemo, useRef, useEffect } from "react"
import { format, addDays, subDays, isSameDay, isToday } from "date-fns"
import { pl } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"

interface DayTaskCount {
  date: string
  count: number
}

interface WeekStripProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  taskCounts: DayTaskCount[]
}

export function WeekStrip({ selectedDate, onDateSelect, taskCounts }: WeekStripProps) {
  const { workspace } = useWorkspaceStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Generate 14 days: 7 days before today + today + 6 days after
  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 14 }, (_, i) => subDays(today, 7 - i))
  }, [])

  const getTaskCount = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    return taskCounts.find(tc => tc.date === dateStr)?.count ?? 0
  }

  // Auto-scroll to selected date on mount and when selection changes
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current
      const selected = selectedRef.current
      const containerRect = container.getBoundingClientRect()
      const selectedRect = selected.getBoundingClientRect()

      // Center the selected element
      const scrollLeft = selected.offsetLeft - (containerRect.width / 2) + (selectedRect.width / 2)
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [selectedDate])

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg overflow-x-auto scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate)
        const isCurrentDay = isToday(day)
        const taskCount = getTaskCount(day)

        return (
          <button
            key={day.toISOString()}
            ref={isSelected ? selectedRef : null}
            onClick={() => onDateSelect(day)}
            className={cn(
              "flex flex-col items-center px-2.5 md:px-3 py-2 rounded-lg transition-all min-w-[48px] md:min-w-[52px] flex-shrink-0",
              isSelected
                ? workspace === "WORK"
                  ? "bg-work text-work-foreground shadow-sm"
                  : "bg-private text-private-foreground shadow-sm"
                : "hover:bg-muted",
              isCurrentDay && !isSelected && "ring-2 ring-primary/30"
            )}
          >
            <span className={cn(
              "text-[10px] font-medium uppercase",
              isSelected ? "opacity-90" : "text-muted-foreground"
            )}>
              {format(day, "EEE", { locale: pl })}
            </span>
            <span className={cn(
              "text-base md:text-lg font-bold",
              !isSelected && isCurrentDay && "text-primary"
            )}>
              {format(day, "d")}
            </span>
            {taskCount > 0 ? (
              <span className={cn(
                "text-[10px] px-1.5 rounded-full min-w-[18px] text-center",
                isSelected
                  ? "bg-white/20"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {taskCount}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 min-w-[18px] h-[14px]" />
            )}
          </button>
        )
      })}
    </div>
  )
}
