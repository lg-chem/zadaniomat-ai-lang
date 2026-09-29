import type { Task } from "@/hooks/use-tasks"
import type { BlockData } from "@/hooks/use-schedule-blocks"
import {
  eventMinutes,
  isValidTime,
  occurrencesOnDay,
  recurringTaskOccursOn,
  timeToMinutes,
  toDayString,
  type EventOccurrence,
} from "@/lib/calendar"

// Everything the calendar draws, flattened to one shape per day

export interface RecurringTaskTemplate {
  id: string
  title: string
  description?: string | null
  scheduledDate?: string | null
  scheduledTime?: string | null
  plannedMinutes?: number | null
  recurrenceRule: string
  categoryId?: string | null
  category?: { id: string; name: string; color: string } | null
}

interface ItemBase {
  key: string
  day: string
  title: string
  color: string
  allDay: boolean
  start: number // minutes from midnight (timed items)
  end: number
}

export type CalendarItem =
  | (ItemBase & { kind: "event"; occurrence: EventOccurrence })
  | (ItemBase & { kind: "task"; task: Task })
  | (ItemBase & { kind: "recurring"; template: RecurringTaskTemplate })

export interface BlockItem {
  key: string
  day: string
  block: BlockData
  isOverride: boolean
  start: number
  end: number
}

export interface DayItems {
  allDay: CalendarItem[]
  timed: CalendarItem[]
}

export interface CalendarFilters {
  events: boolean
  tasks: boolean
  completed: boolean
  recurring: boolean
  blocks: boolean
}

export const DEFAULT_FILTERS: CalendarFilters = {
  events: true,
  tasks: true,
  completed: true,
  recurring: true,
  blocks: true,
}

export const TASK_FALLBACK_COLOR = "#64748b"
const DAY_END = 24 * 60

export function isDraggable(item: CalendarItem): boolean {
  return item.kind === "event" || (item.kind === "task" && item.task.status !== "COMPLETED")
}

export function taskMinutes(task: Pick<Task, "scheduledTime" | "plannedMinutes">) {
  if (!task.scheduledTime || !isValidTime(task.scheduledTime)) return null
  const start = timeToMinutes(task.scheduledTime)
  return { start, end: Math.min(DAY_END, start + Math.max(15, task.plannedMinutes || 30)) }
}

interface BuildOptions {
  days: string[]
  today: string
  occurrences: EventOccurrence[]
  tasks: Task[]
  templates: RecurringTaskTemplate[]
  filters: CalendarFilters
}

export function buildDayItems({ days, today, occurrences, tasks, templates, filters }: BuildOptions) {
  const result = new Map<string, DayItems>()
  const tasksByDay = new Map<string, Task[]>()

  for (const task of tasks) {
    if (!task.scheduledDate || task.status === "CANCELLED") continue
    const day = toDayString(task.scheduledDate)
    const list = tasksByDay.get(day) ?? []
    list.push(task)
    tasksByDay.set(day, list)
  }

  for (const day of days) {
    const allDay: CalendarItem[] = []
    const timed: CalendarItem[] = []

    if (filters.events) {
      for (const occurrence of occurrencesOnDay(occurrences, day)) {
        const event = occurrence.event
        const base = {
          key: `${occurrence.key}@${day}`,
          day,
          title: event.title,
          color: occurrence.color,
          kind: "event" as const,
          occurrence,
        }
        if (event.allDay) {
          allDay.push({ ...base, allDay: true, start: 0, end: DAY_END })
        } else {
          const { start, end } = eventMinutes(event)
          timed.push({ ...base, allDay: false, start, end })
        }
      }
    }

    const dayTasks = tasksByDay.get(day) ?? []
    if (filters.tasks) {
      for (const task of dayTasks) {
        if (task.status === "COMPLETED" && !filters.completed) continue
        const minutes = taskMinutes(task)
        const base = {
          key: `task:${task.id}`,
          day,
          title: task.title,
          color: task.category?.color || TASK_FALLBACK_COLOR,
          kind: "task" as const,
          task,
        }
        if (minutes) timed.push({ ...base, allDay: false, ...minutes })
        else allDay.push({ ...base, allDay: true, start: 0, end: DAY_END })
      }
    }

    // Recurring tasks are created in the schedule when the day is opened;
    // until then the calendar shows where they will appear
    if (filters.tasks && filters.recurring && day >= today) {
      for (const template of templates) {
        if (!template.scheduledDate) continue
        const startDay = toDayString(template.scheduledDate)
        if (day === startDay || !recurringTaskOccursOn(template.recurrenceRule, startDay, day)) continue
        const exists = dayTasks.some(
          (t) => t.title === template.title && (t.categoryId ?? null) === (template.categoryId ?? null)
        )
        if (exists) continue
        const minutes = taskMinutes(template)
        const base = {
          key: `recurring:${template.id}@${day}`,
          day,
          title: template.title,
          color: template.category?.color || TASK_FALLBACK_COLOR,
          kind: "recurring" as const,
          template,
        }
        if (minutes) timed.push({ ...base, allDay: false, ...minutes })
        else allDay.push({ ...base, allDay: true, start: 0, end: DAY_END })
      }
    }

    const rank = (item: CalendarItem) =>
      item.kind === "event" ? 0 : item.kind === "task" ? (item.task.status === "COMPLETED" ? 3 : 1) : 2
    allDay.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, "pl"))
    timed.sort((a, b) => a.start - b.start || b.end - a.end)

    result.set(day, { allDay, timed })
  }

  return result
}

export function buildBlockItems(
  days: string[],
  blocksForDay: (day: string) => { blocks: BlockData[]; isOverride: boolean }
) {
  const result = new Map<string, BlockItem[]>()
  for (const day of days) {
    const { blocks, isOverride } = blocksForDay(day)
    result.set(
      day,
      blocks
        .filter((b) => isValidTime(b.startTime) && isValidTime(b.endTime))
        .map((block, index) => ({
          key: `block:${day}:${index}`,
          day,
          block,
          isOverride,
          start: timeToMinutes(block.startTime),
          end: Math.max(timeToMinutes(block.endTime), timeToMinutes(block.startTime) + 15),
        }))
        .sort((a, b) => a.start - b.start)
    )
  }
  return result
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, "0")}`
}

export function formatRange(start: number, end: number): string {
  return `${formatMinutes(start)} – ${formatMinutes(end)}`
}
