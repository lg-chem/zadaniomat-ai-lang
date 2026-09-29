"use client"

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { ChevronDown, ChevronUp, Repeat, CheckCircle2, Circle } from "lucide-react"
import { layoutTimedItems, weekdayOf } from "@/lib/calendar"
import { cn } from "@/lib/utils"
import { readableTextColor, withAlpha } from "./color"
import { ItemChip } from "./item-chip"
import { formatMinutes, formatRange, isDraggable, type BlockItem, type CalendarItem, type DayItems } from "./items"

export const HOUR_HEIGHT = 48
const SNAP = 15
const DAY_MINUTES = 24 * 60
const DRAG_THRESHOLD = 5
const ALL_DAY_VISIBLE = 3
const WEEKDAY_SHORT = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"]

export interface MoveTarget {
  day: string
  allDay: boolean
  start: number
  end: number
}

interface TimeGridProps {
  days: string[]
  today: string
  items: Map<string, DayItems>
  blocks: Map<string, BlockItem[]>
  // start/end null = all-day
  onCreate: (day: string, start: number | null, end: number | null) => void
  onItemClick: (item: CalendarItem) => void
  onItemMove: (item: CalendarItem, target: MoveTarget) => void
  onBlockClick: (block: BlockItem) => void
  onDayClick: (day: string) => void
}

type Drag =
  | { type: "create"; pointerId: number; dayIndex: number; anchor: number; current: number }
  | {
      type: "move"
      pointerId: number
      item: CalendarItem
      originX: number
      originY: number
      moved: boolean
      grabOffset: number
      duration: number
      target: MoveTarget | null
    }
  | { type: "resize"; pointerId: number; item: CalendarItem; start: number; end: number; moved: boolean; originY: number }

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

const snap = (minutes: number) => Math.floor(minutes / SNAP) * SNAP
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const toPx = (minutes: number) => (minutes / 60) * HOUR_HEIGHT

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export function TimeGrid({ days, today, items, blocks, onCreate, onItemClick, onItemMove, onBlockClick, onDayClick }: TimeGridProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const allDayRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const [now, setNow] = useState(nowMinutes)
  const [allDayExpanded, setAllDayExpanded] = useState(false)

  const setDrag = (next: Drag | null) => {
    dragRef.current = next
    setDragState(next)
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(nowMinutes()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // Start the view around the working day (or a bit before the current time)
  const rangeKey = `${days[0]}:${days.length}`
  useIsomorphicLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const target = days.includes(today) ? clamp(nowMinutes() - 120, 0, 8 * 60) : 7 * 60
    body.scrollTop = toPx(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey])

  // ---------- geometry ----------

  const pointToGrid = (clientX: number, clientY: number) => {
    const columns = columnsRef.current!.getBoundingClientRect()
    const dayIndex = clamp(Math.floor(((clientX - columns.left) / columns.width) * days.length), 0, days.length - 1)
    const minutes = ((clientY - columns.top) / HOUR_HEIGHT) * 60
    const bodyTop = bodyRef.current!.getBoundingClientRect().top
    return { dayIndex, minutes, inAllDay: clientY < bodyTop }
  }

  const autoScroll = (clientY: number) => {
    const body = bodyRef.current
    if (!body) return
    const rect = body.getBoundingClientRect()
    if (clientY > rect.bottom - 32) body.scrollTop += 16
    else if (clientY < rect.top + 32 && clientY > rect.top) body.scrollTop -= 16
  }

  const capture = (e: ReactPointerEvent) => {
    try {
      rootRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // Pointer may already be released (e.g. touch cancelled)
    }
  }

  // ---------- pointer handlers ----------

  const startCreate = (e: ReactPointerEvent, dayIndex: number) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return
    const { minutes } = pointToGrid(e.clientX, e.clientY)
    const anchor = clamp(snap(minutes), 0, DAY_MINUTES - SNAP)
    capture(e)
    setDrag({ type: "create", pointerId: e.pointerId, dayIndex, anchor, current: anchor })
  }

  const startMove = (e: ReactPointerEvent, item: CalendarItem) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const duration = item.allDay
      ? item.kind === "task"
        ? Math.max(15, item.task.plannedMinutes || 30)
        : 60
      : item.end - item.start
    let grabOffset = Math.min(15, duration / 2)
    if (!item.allDay) {
      const { minutes } = pointToGrid(e.clientX, e.clientY)
      grabOffset = clamp(minutes - item.start, 0, duration)
    }
    capture(e)
    setDrag({
      type: "move",
      pointerId: e.pointerId,
      item,
      originX: e.clientX,
      originY: e.clientY,
      moved: false,
      grabOffset,
      duration,
      target: null,
    })
  }

  const startResize = (e: ReactPointerEvent, item: CalendarItem) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    setDrag({ type: "resize", pointerId: e.pointerId, item, start: item.start, end: item.end, moved: false, originY: e.clientY })
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    const current = dragRef.current
    if (!current || current.pointerId !== e.pointerId) return

    if (current.type === "create") {
      autoScroll(e.clientY)
      const { minutes } = pointToGrid(e.clientX, e.clientY)
      const value = clamp(snap(minutes), 0, DAY_MINUTES - SNAP)
      if (value !== current.current) setDrag({ ...current, current: value })
      return
    }

    if (current.type === "resize") {
      autoScroll(e.clientY)
      const { minutes } = pointToGrid(e.clientX, e.clientY)
      const end = clamp(Math.round(minutes / SNAP) * SNAP, current.start + SNAP, DAY_MINUTES)
      const moved = current.moved || Math.abs(e.clientY - current.originY) > DRAG_THRESHOLD
      if (end !== current.end || moved !== current.moved) setDrag({ ...current, end, moved })
      return
    }

    const moved =
      current.moved || Math.hypot(e.clientX - current.originX, e.clientY - current.originY) > DRAG_THRESHOLD
    if (!moved || !isDraggable(current.item)) return
    autoScroll(e.clientY)

    const { dayIndex, minutes, inAllDay } = pointToGrid(e.clientX, e.clientY)
    const day = days[dayIndex]
    let target: MoveTarget
    if (inAllDay) {
      target = { day, allDay: true, start: 0, end: DAY_MINUTES }
    } else {
      const start = clamp(snap(minutes - current.grabOffset + SNAP / 2), 0, DAY_MINUTES - current.duration)
      target = { day, allDay: false, start, end: start + current.duration }
    }
    const t = current.target
    if (!current.moved || !t || t.day !== target.day || t.allDay !== target.allDay || t.start !== target.start) {
      setDrag({ ...current, moved: true, target })
    }
  }

  const handlePointerUp = (e: ReactPointerEvent) => {
    const current = dragRef.current
    if (!current || current.pointerId !== e.pointerId) return
    setDrag(null)

    if (current.type === "create") {
      const day = days[current.dayIndex]
      if (current.anchor === current.current) {
        const start = Math.floor(current.anchor / 30) * 30
        onCreate(day, start, Math.min(start + 60, DAY_MINUTES - 1))
      } else {
        const start = Math.min(current.anchor, current.current)
        const end = Math.max(current.anchor, current.current) + SNAP
        onCreate(day, start, Math.min(end, DAY_MINUTES - 1))
      }
      return
    }

    if (current.type === "resize") {
      if (current.moved && current.end !== current.item.end) {
        onItemMove(current.item, { day: current.item.day, allDay: false, start: current.start, end: current.end })
      }
      return
    }

    if (!current.moved) {
      onItemClick(current.item)
      return
    }
    const target = current.target
    if (!target) return
    const item = current.item
    const unchanged =
      target.day === item.day && target.allDay === item.allDay && (target.allDay || target.start === item.start)
    if (!unchanged) onItemMove(item, target)
  }

  const handlePointerCancel = () => setDrag(null)

  // ---------- rendering ----------

  const moving = drag?.type === "move" && drag.moved ? drag : null
  const resizing = drag?.type === "resize" ? drag : null
  const creating = drag?.type === "create" ? drag : null
  const gridCols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }
  const maxAllDay = Math.max(0, ...days.map((d) => items.get(d)?.allDay.length ?? 0))

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Day headers */}
      <div className="flex shrink-0 border-b overflow-y-hidden [scrollbar-gutter:stable]">
        <div className="w-14 shrink-0" />
        <div className="grid flex-1" style={gridCols}>
          {days.map((day) => {
            const isToday = day === today
            const date = Number(day.slice(8, 10))
            return (
              <button
                key={day}
                type="button"
                onClick={() => onDayClick(day)}
                className="flex flex-col items-center gap-0.5 border-l py-2 first:border-l-0 hover:bg-muted/40"
              >
                <span className={cn("text-[11px] font-medium uppercase", isToday ? "text-blue-600" : "text-muted-foreground")}>
                  {WEEKDAY_SHORT[weekdayOf(day)]}
                </span>
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xl",
                    isToday ? "bg-blue-600 text-white" : "hover:bg-muted"
                  )}
                >
                  {date}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* All-day row */}
      <div className="flex shrink-0 border-b overflow-y-hidden [scrollbar-gutter:stable]">
        <div className="flex w-14 shrink-0 flex-col items-end justify-between py-1 pr-2 text-[10px] text-muted-foreground">
          <span>cały dzień</span>
          {maxAllDay > ALL_DAY_VISIBLE && (
            <button
              type="button"
              onClick={() => setAllDayExpanded((v) => !v)}
              className="rounded p-0.5 hover:bg-muted"
              title={allDayExpanded ? "Zwiń" : "Pokaż wszystkie"}
            >
              {allDayExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <div ref={allDayRef} className="grid flex-1" style={gridCols}>
          {days.map((day) => {
            const list = items.get(day)?.allDay ?? []
            const visible = allDayExpanded ? list : list.slice(0, ALL_DAY_VISIBLE)
            const hidden = list.length - visible.length
            const isTarget = moving?.target?.allDay && moving.target.day === day
            return (
              <div
                key={day}
                className={cn(
                  "min-h-[30px] space-y-0.5 border-l p-0.5 first:border-l-0",
                  isTarget && "bg-blue-500/10"
                )}
                onClick={(e) => {
                  if (e.target === e.currentTarget) onCreate(day, null, null)
                }}
              >
                {visible.map((item) => (
                  <ItemChip
                    key={item.key}
                    item={item}
                    dimmed={moving?.item.key === item.key}
                    onPointerDown={(e) => startMove(e, item)}
                  />
                ))}
                {hidden > 0 && (
                  <button
                    type="button"
                    className="w-full rounded px-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted"
                    onClick={() => setAllDayExpanded(true)}
                  >
                    +{hidden} więcej
                  </button>
                )}
                {isTarget && moving && (
                  <ItemChip item={{ ...moving.item, allDay: true } as CalendarItem} className="opacity-80 shadow" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Hours */}
      <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="flex" style={{ height: toPx(DAY_MINUTES) }}>
          <div className="relative w-14 shrink-0">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {hour}:00
              </span>
            ))}
          </div>

          <div ref={columnsRef} className="relative grid flex-1" style={gridCols}>
            {/* Hour lines */}
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="border-b border-border/70" style={{ height: HOUR_HEIGHT }} />
              ))}
            </div>

            {days.map((day, dayIndex) => {
              const dayItems = items.get(day)?.timed ?? []
              const dayBlocks = blocks.get(day) ?? []
              const layout = layoutTimedItems(
                dayItems.map((item) => ({
                  key: item.key,
                  start: item.start,
                  end: resizing?.item.key === item.key ? resizing.end : item.end,
                }))
              )
              const showGhost = moving?.target && !moving.target.allDay && moving.target.day === day

              return (
                <div
                  key={day}
                  className={cn("relative border-l first:border-l-0", day === today && "bg-blue-500/[0.03]")}
                  onPointerDown={(e) => startCreate(e, dayIndex)}
                >
                  {/* Time blocks from the weekly template */}
                  {dayBlocks.map((block) => {
                    const color = block.block.color || "#6366f1"
                    return (
                      <div
                        key={block.key}
                        className="pointer-events-none absolute inset-x-0"
                        style={{
                          top: toPx(block.start),
                          height: toPx(block.end - block.start),
                          backgroundColor: withAlpha(color, 0.09),
                          borderLeft: `3px solid ${withAlpha(color, 0.7)}`,
                        }}
                      >
                        <button
                          type="button"
                          className="pointer-events-auto absolute right-1 top-0.5 max-w-[60%] truncate rounded px-1 text-[10px] font-medium hover:bg-background/80"
                          style={{ color }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => onBlockClick(block)}
                          title={`${block.block.name} · ${formatRange(block.start, block.end)}`}
                        >
                          {block.block.name}
                        </button>
                      </div>
                    )
                  })}

                  {/* Selection while dragging on an empty slot */}
                  {creating && creating.dayIndex === dayIndex && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-20 rounded-md bg-blue-600/90 px-1.5 py-0.5 text-[11px] text-white shadow-lg"
                      style={{
                        top: toPx(Math.min(creating.anchor, creating.current)),
                        height: toPx(Math.abs(creating.current - creating.anchor) + SNAP),
                      }}
                    >
                      {formatRange(
                        Math.min(creating.anchor, creating.current),
                        Math.max(creating.anchor, creating.current) + SNAP
                      )}
                    </div>
                  )}

                  {dayItems.map((item) => {
                    const place = layout.get(item.key) ?? { column: 0, columns: 1 }
                    const end = resizing?.item.key === item.key ? resizing.end : item.end
                    return (
                      <TimedItem
                        key={item.key}
                        item={item}
                        end={end}
                        column={place.column}
                        columns={place.columns}
                        dimmed={moving?.item.key === item.key}
                        onPointerDown={(e) => startMove(e, item)}
                        onResizeStart={(e) => startResize(e, item)}
                      />
                    )
                  })}

                  {showGhost && moving?.target && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-30 overflow-hidden rounded-md px-1.5 py-0.5 text-xs shadow-xl ring-2 ring-white/60"
                      style={{
                        top: toPx(moving.target.start),
                        height: Math.max(toPx(moving.duration) - 2, 18),
                        backgroundColor: moving.item.color,
                        color: readableTextColor(moving.item.color),
                      }}
                    >
                      <div className="truncate font-medium">{moving.item.title}</div>
                      <div className="opacity-90">{formatRange(moving.target.start, moving.target.end)}</div>
                    </div>
                  )}

                  {/* Current time */}
                  {day === today && (
                    <div className="pointer-events-none absolute inset-x-0 z-40" style={{ top: toPx(now) }}>
                      <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
                      <div className="h-0.5 bg-red-500" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TimedItemProps {
  item: CalendarItem
  end: number
  column: number
  columns: number
  dimmed: boolean
  onPointerDown: (e: ReactPointerEvent) => void
  onResizeStart: (e: ReactPointerEvent) => void
}

function TimedItem({ item, end, column, columns, dimmed, onPointerDown, onResizeStart }: TimedItemProps) {
  const height = Math.max(toPx(end - item.start) - 2, 18)
  const compact = height < 34
  const width = 100 / columns
  const style: React.CSSProperties = {
    top: toPx(item.start),
    height,
    left: `calc(${column * width}% + 1px)`,
    width: `calc(${width}% - 10px)`,
  }
  const time = formatRange(item.start, end)

  let className = "absolute z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-xs leading-tight shadow-sm cursor-pointer"
  let content: React.ReactNode

  if (item.kind === "event") {
    Object.assign(style, { backgroundColor: item.color, color: readableTextColor(item.color) })
    className = cn(className, "border border-white/50 hover:brightness-95")
    content = compact ? (
      <div className="truncate">
        <span className="font-medium">{item.title}</span>
        <span className="opacity-90">, {formatMinutes(item.start)}</span>
      </div>
    ) : (
      <>
        <div className="line-clamp-2 font-medium">{item.title}</div>
        <div className="truncate opacity-90">{time}</div>
      </>
    )
  } else if (item.kind === "task") {
    const done = item.task.status === "COMPLETED"
    const Icon = done ? CheckCircle2 : Circle
    Object.assign(style, { borderLeft: `3px solid ${item.color}`, backgroundColor: withAlpha(item.color, 0.12) })
    className = cn(className, "border bg-background text-foreground hover:bg-muted", done && "opacity-60")
    content = (
      <div className={cn("flex gap-1", compact ? "items-center" : "items-start")}>
        <Icon className="mt-px h-3 w-3 shrink-0" style={{ color: item.color }} />
        <div className="min-w-0">
          <div className={cn("font-medium", compact ? "truncate" : "line-clamp-2", done && "line-through")}>{item.title}</div>
          {!compact && <div className="truncate text-muted-foreground">{time}</div>}
        </div>
      </div>
    )
  } else {
    Object.assign(style, { border: `1px dashed ${item.color}`, backgroundColor: withAlpha(item.color, 0.06) })
    className = cn(className, "italic text-muted-foreground shadow-none")
    content = (
      <div className="flex items-center gap-1">
        <Repeat className="h-3 w-3 shrink-0" style={{ color: item.color }} />
        <span className="truncate">{item.title}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(className, dimmed && "opacity-40")}
      style={style}
      title={`${item.title} · ${time}`}
      onPointerDown={onPointerDown}
    >
      {content}
      {isDraggable(item) && (
        <div
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
          onPointerDown={onResizeStart}
          aria-hidden
        />
      )}
    </div>
  )
}
