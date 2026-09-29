"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CalendarDays, CalendarPlus, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCategories } from "@/hooks/use-categories"
import {
  useCalendarEventActions,
  useCalendarEvents,
  type EditScope,
} from "@/hooks/use-calendar-events"
import { eventMinutes, minutesToTime, occurrencesOnDay, type EventOccurrence } from "@/lib/calendar"
import { htmlToPlainText } from "@/lib/rich-text"
import { EventDialog, type EventDraft } from "./event-dialog"
import { ItemPreviewDialog, type PreviewTarget } from "./item-preview-dialog"
import { formatRange, type CalendarItem } from "./items"
import { useScopePrompt } from "./scope-dialog"

function toItem(occurrence: EventOccurrence, day: string): Extract<CalendarItem, { kind: "event" }> {
  const { start, end } = occurrence.event.allDay ? { start: 0, end: 24 * 60 } : eventMinutes(occurrence.event)
  return {
    kind: "event",
    key: `${occurrence.key}@${day}`,
    day,
    title: occurrence.event.title,
    color: occurrence.color,
    allDay: occurrence.event.allDay,
    start,
    end,
    occurrence,
  }
}

// Calendar events of one day, shown in the daily schedule
export function DayEventsCard({ date }: { date: string }) {
  const range = useMemo(() => ({ from: date, to: date }), [date])
  const { occurrences } = useCalendarEvents(range)
  const { categories } = useCategories()
  const { deleteEvent } = useCalendarEventActions()
  const { askScope, confirmDelete, element: scopePrompt } = useScopePrompt()

  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [editing, setEditing] = useState<EventOccurrence | null>(null)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)

  const items = useMemo(() => occurrencesOnDay(occurrences, date).map((o) => toItem(o, date)), [occurrences, date])

  const openCreate = () => {
    const now = new Date()
    const isToday = date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const start = isToday ? Math.min(now.getHours() + 1, 23) * 60 : 9 * 60
    setDraft({ date, startTime: minutesToTime(start), endTime: minutesToTime(start + 60) })
  }

  const handleDelete = async (item: Extract<CalendarItem, { kind: "event" }>) => {
    const { event, date: occurrenceDate } = item.occurrence
    let options: { scope?: EditScope; date?: string } = {}
    if (event.recurrenceRule) {
      const scope = await askScope("delete")
      if (!scope) return
      options = { scope, date: occurrenceDate }
    } else if (!(await confirmDelete(event.title))) {
      return
    }
    setPreview(null)
    try {
      await deleteEvent(event, options)
      toast.success("Usunięto wydarzenie")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się usunąć")
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CalendarDays className="h-5 w-5" />
            Wydarzenia
            {items.length > 0 && <span className="text-sm font-normal text-muted-foreground">({items.length})</span>}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={openCreate}>
              <CalendarPlus className="mr-1 h-4 w-4" />
              Wydarzenie
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/calendar?view=day&date=${date}`}>Kalendarz</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Brak wydarzeń tego dnia. Dodaj spotkanie, wizytę albo blok czasu — z opisem i powtarzaniem.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => {
              const description = htmlToPlainText(item.occurrence.event.description).replace(/\s+/g, " ")
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPreview({ type: "item", item })}
                  className="flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  style={{ borderLeft: `4px solid ${item.color}` }}
                >
                  <span className="w-24 shrink-0 pt-0.5 text-xs text-muted-foreground">
                    {item.allDay ? "Cały dzień" : formatRange(item.start, item.end)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{item.title}</span>
                      {item.occurrence.event.recurrenceRule && (
                        <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                    </span>
                    {description && <span className="block truncate text-xs text-muted-foreground">{description}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>

      <EventDialog
        open={!!draft || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null)
            setEditing(null)
          }
        }}
        draft={draft}
        occurrence={editing}
        categories={categories}
      />
      <ItemPreviewDialog
        target={preview}
        onClose={() => setPreview(null)}
        onEditEvent={(item) => {
          setPreview(null)
          setEditing(item.occurrence)
        }}
        onDeleteEvent={handleDelete}
        onEditTask={() => undefined}
        onToggleTask={() => undefined}
      />
      {scopePrompt}
    </Card>
  )
}
