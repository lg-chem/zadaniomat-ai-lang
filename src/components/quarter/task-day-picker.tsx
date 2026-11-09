"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { CalendarX, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { addDaysToKey, dayKeyToDate, dayKeyToLocalDate, daysBetween, localDayKey } from "@/lib/quarters"

/** "Dziś", "Jutro", "Wczoraj" or "pon 16 lis" */
export function dayLabel(dayKey: string, today = localDayKey()): string {
  const diff = daysBetween(today, dayKey)
  if (diff === 0) return "Dziś"
  if (diff === 1) return "Jutro"
  if (diff === -1) return "Wczoraj"
  return format(dayKeyToLocalDate(dayKey), "EEEEEE d MMM", { locale: pl })
}

/** Link that opens the day in Harmonogram with the task expanded */
export const scheduleTaskHref = (dayKey: string, taskId: string) => `/schedule?date=${dayKey}&task=${taskId}`

function nextMondayKey(today: string): string {
  const dow = dayKeyToDate(today).getUTCDay() // 0 = Sunday
  return addDaysToKey(today, (8 - dow) % 7 || 7)
}

/** Day of a task in Harmonogram: today, tomorrow, next Monday or any day from the calendar */
export function TaskDayPicker({
  dayKey,
  onSelect,
  taskId,
  emptyLabel = "Usuń dzień",
  children,
  align = "end",
}: {
  dayKey: string | null
  onSelect: (dayKey: string | null) => void
  // Shows "Otwórz w harmonogramie" for a planned task
  taskId?: string
  emptyLabel?: string
  children: ReactNode
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = useState(false)
  const today = localDayKey()
  const tomorrow = addDaysToKey(today, 1)
  const monday = nextMondayKey(today)
  const quick = [today, tomorrow, ...(monday !== tomorrow ? [monday] : [])]

  const pick = (key: string | null) => {
    setOpen(false)
    if (key !== dayKey) onSelect(key)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[calc(100vw-16px)] overflow-y-auto p-0"
        align={align}
        collisionPadding={8}
      >
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {quick.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={key === dayKey ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              onClick={() => pick(key)}
            >
              {dayLabel(key, today)}
            </Button>
          ))}
        </div>
        <Calendar
          mode="single"
          selected={dayKey ? dayKeyToLocalDate(dayKey) : undefined}
          defaultMonth={dayKey ? dayKeyToLocalDate(dayKey) : undefined}
          onSelect={(date) => date && pick(localDayKey(date))}
          initialFocus
        />
        {dayKey && (
          <div className="flex flex-wrap items-center justify-between gap-1 border-t p-2">
            {taskId ? (
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                <Link href={scheduleTaskHref(dayKey, taskId)} prefetch={false}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Otwórz w harmonogramie
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => pick(null)}
            >
              <CalendarX className="mr-1.5 h-3.5 w-3.5" />
              {emptyLabel}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
