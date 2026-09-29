"use client"

import Link from "next/link"
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  LayoutGrid,
  Pencil,
  Repeat,
  Settings2,
  Tag,
  Trash2,
  AlignLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RichTextView } from "@/components/editor/lazy"
import { describeRecurrence, formatDayLong } from "@/lib/calendar"
import { isEmptyRichText } from "@/lib/rich-text"
import type { Task } from "@/hooks/use-tasks"
import { formatMinutes, formatRange, type BlockItem, type CalendarItem } from "./items"

export type PreviewTarget = { type: "item"; item: CalendarItem } | { type: "block"; block: BlockItem }

const TASK_STATUS_LABELS: Record<string, string> = {
  NEW: "Nowe",
  IN_PROGRESS: "W trakcie",
  COMPLETED: "Zakończone",
  CANCELLED: "Anulowane",
  TO_TRANSFER: "Do przeniesienia",
}

const TASK_RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Codziennie",
  WEEKDAYS: "W dni robocze",
  WEEKLY: "Co tydzień",
  MONTHLY: "Co miesiąc",
}

function weekdayName(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("pl-PL", { weekday: "long" })
}

function Row({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

interface ItemPreviewDialogProps {
  target: PreviewTarget | null
  onClose: () => void
  onEditEvent: (item: Extract<CalendarItem, { kind: "event" }>) => void
  onDeleteEvent: (item: Extract<CalendarItem, { kind: "event" }>) => void
  onEditTask: (task: Task) => void
  onToggleTask: (task: Task) => void
}

export function ItemPreviewDialog({
  target,
  onClose,
  onEditEvent,
  onDeleteEvent,
  onEditTask,
  onToggleTask,
}: ItemPreviewDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg outline-none" onOpenAutoFocus={(e) => e.preventDefault()}>
        {target?.type === "item" && (
          <ItemPreview
            item={target.item}
            onClose={onClose}
            onEditEvent={onEditEvent}
            onDeleteEvent={onDeleteEvent}
            onEditTask={onEditTask}
            onToggleTask={onToggleTask}
          />
        )}
        {target?.type === "block" && <BlockPreview block={target.block} />}
      </DialogContent>
    </Dialog>
  )
}

function Header({ color, title, subtitle, dashed }: { color: string; title: string; subtitle: string; dashed?: boolean }) {
  return (
    <DialogHeader className="pr-6 text-left">
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded"
          style={dashed ? { border: `2px dashed ${color}` } : { backgroundColor: color }}
        />
        <div className="min-w-0">
          <DialogTitle className="text-xl font-medium leading-snug break-words">{title}</DialogTitle>
          <DialogDescription className="mt-0.5">{subtitle}</DialogDescription>
        </div>
      </div>
    </DialogHeader>
  )
}

function Description({ value }: { value?: string | null }) {
  if (isEmptyRichText(value)) return null
  return (
    <Row icon={AlignLeft}>
      <div className="max-h-[45vh] overflow-y-auto rounded-md border bg-muted/20 px-3 py-2">
        <RichTextView value={value} className="text-sm" />
      </div>
    </Row>
  )
}

function ItemPreview({
  item,
  onClose,
  onEditEvent,
  onDeleteEvent,
  onEditTask,
  onToggleTask,
}: { item: CalendarItem; onClose: () => void } & Omit<ItemPreviewDialogProps, "target" | "onClose">) {
  const dayLabel = `${weekdayName(item.day)}, ${formatDayLong(item.day)}`

  if (item.kind === "event") {
    const { event, date, endDate } = item.occurrence
    const when = event.allDay
      ? date === endDate
        ? `${dayLabel} · cały dzień`
        : `${formatDayLong(date)} – ${formatDayLong(endDate)}`
      : `${dayLabel} · ${formatRange(item.start, item.end)}`
    const recurrence = describeRecurrence(event)

    return (
      <>
        <Header color={item.color} title={event.title} subtitle={when} />
        <div className="space-y-3">
          {recurrence && <Row icon={Repeat}>{recurrence}</Row>}
          {event.category && (
            <Row icon={Tag}>
              <Badge variant="outline" style={{ borderColor: event.category.color, color: event.category.color }}>
                {event.category.name}
              </Badge>
            </Row>
          )}
          <Description value={event.description} />
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDeleteEvent(item)}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Usuń
          </Button>
          <Button asChild variant="outline">
            <Link href={`/schedule?date=${item.day}`} onClick={onClose}>
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Harmonogram dnia
            </Link>
          </Button>
          <Button onClick={() => onEditEvent(item)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edytuj
          </Button>
        </div>
      </>
    )
  }

  if (item.kind === "task") {
    const task = item.task
    const done = task.status === "COMPLETED"
    return (
      <>
        <Header color={item.color} title={task.title} subtitle={`Zadanie · ${dayLabel}`} />
        <div className="space-y-3">
          <Row icon={Clock}>
            {item.allDay ? "Bez godziny" : formatRange(item.start, item.end)}
            {task.plannedMinutes ? ` · plan ${formatMinutes(task.plannedMinutes)} h` : ""}
            <Badge variant="secondary" className="ml-2">
              {TASK_STATUS_LABELS[task.status] ?? task.status}
            </Badge>
          </Row>
          {task.category && (
            <Row icon={Tag}>
              <Badge variant="outline" style={{ borderColor: task.category.color, color: task.category.color }}>
                {task.category.name}
              </Badge>
            </Row>
          )}
          <Description value={task.description} />
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onToggleTask(task)}>
            {done ? <Circle className="mr-1.5 h-4 w-4" /> : <CheckCircle2 className="mr-1.5 h-4 w-4 text-green-600" />}
            {done ? "Przywróć" : "Zrobione"}
          </Button>
          <Button variant="outline" onClick={() => onEditTask(task)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edytuj
          </Button>
          <Button asChild>
            <Link href={`/schedule?date=${item.day}`} onClick={onClose}>
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Otwórz w harmonogramie
            </Link>
          </Button>
        </div>
      </>
    )
  }

  const template = item.template
  return (
    <>
      <Header color={item.color} title={template.title} subtitle={`Zadanie cykliczne · ${dayLabel}`} dashed />
      <div className="space-y-3">
        <Row icon={Repeat}>
          {TASK_RECURRENCE_LABELS[template.recurrenceRule] ?? template.recurrenceRule}
          {!item.allDay && ` · ${formatRange(item.start, item.end)}`}
          <p className="mt-1 text-xs text-muted-foreground">
            Pojawi się w harmonogramie, gdy otworzysz ten dzień.
          </p>
        </Row>
        <Description value={template.description} />
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button asChild variant="outline">
          <Link href="/recurring" onClick={onClose}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Zadania cykliczne
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/schedule?date=${item.day}`} onClick={onClose}>
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Otwórz harmonogram dnia
          </Link>
        </Button>
      </div>
    </>
  )
}

function BlockPreview({ block }: { block: BlockItem }) {
  const color = block.block.color || "#6366f1"
  return (
    <>
      <Header
        color={color}
        title={block.block.name || "Blok czasowy"}
        subtitle={`Blok czasowy · ${weekdayName(block.day)}, ${formatDayLong(block.day)} · ${formatRange(block.start, block.end)}`}
      />
      <div className="space-y-3">
        <Row icon={LayoutGrid}>
          {block.isOverride ? "Bloki zmienione dla tego dnia" : "Z tygodniowego szablonu bloków"}
        </Row>
        {block.block.description && <Row icon={AlignLeft}>{block.block.description}</Row>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button asChild variant="outline">
          <Link href="/settings/weekly-schedule">
            <Settings2 className="mr-1.5 h-4 w-4" />
            Szablon tygodnia
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/schedule?date=${block.day}`}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Zmień bloki tego dnia
          </Link>
        </Button>
      </div>
    </>
  )
}
