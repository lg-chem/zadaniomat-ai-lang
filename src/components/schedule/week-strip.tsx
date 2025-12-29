"use client"

import { useMemo } from "react"
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns"
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

  // Generate week days centered around selected date
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 }) // Monday start
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [selectedDate])

  const getTaskCount = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    return taskCounts.find(tc => tc.date === dateStr)?.count ?? 0
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
      {weekDays.map((day) => {
        const isSelected = isSameDay(day, selectedDate)
        const isCurrentDay = isToday(day)
        const taskCount = getTaskCount(day)

        return (
          <button
            key={day.toISOString()}
            onClick={() => onDateSelect(day)}
            className={cn(
              "flex flex-col items-center px-3 py-2 rounded-lg transition-all min-w-[52px]",
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
              "text-lg font-bold",
              !isSelected && isCurrentDay && "text-primary"
            )}>
              {format(day, "d")}
            </span>
            {taskCount > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 rounded-full min-w-[18px] text-center",
                isSelected
                  ? "bg-white/20"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {taskCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
