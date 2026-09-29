"use client"

import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useSWRConfig } from "swr"
import { CalendarDays, Check, CheckSquare, Clock, Palette, Repeat, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DescriptionField } from "@/components/editor/lazy"
import {
  DEFAULT_EVENT_COLOR,
  EVENT_COLORS,
  describeRecurrence,
  eventMinutes,
  isValidDay,
  minutesToTime,
  timeToMinutes,
  weekdayOf,
  type EventOccurrence,
} from "@/lib/calendar"
import { normalizeRichText } from "@/lib/rich-text"
import {
  useCalendarEventActions,
  useCalendarWorkspace,
  useRevalidateTasks,
  type CalendarEventInput,
} from "@/hooks/use-calendar-events"
import { cn } from "@/lib/utils"
import { useScopePrompt } from "./scope-dialog"

export interface CalendarCategory {
  id: string
  name: string
  color: string
}

export interface EventDraft {
  date: string
  startTime?: string
  endTime?: string
  allDay?: boolean
  kind?: "event" | "task"
}

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // New event / task
  draft?: EventDraft | null
  // Editing an existing event (one occurrence of it for recurring ones)
  occurrence?: EventOccurrence | null
  categories: CalendarCategory[]
  onSaved?: () => void
}

// Fills the form before the dialog paints, so the previous event never flashes
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

type Frequency = "" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY" | "YEARLY"

interface EventForm {
  title: string
  description: string
  date: string
  endDate: string
  allDay: boolean
  startTime: string
  endTime: string
  color: string | null
  categoryId: string
  recurrenceRule: Frequency
  recurrenceInterval: number
  recurrenceDays: number[]
  recurrenceEnd: string
}

interface TaskForm {
  title: string
  description: string
  date: string
  time: string
  plannedMinutes: string
  categoryId: string
  recurrenceRule: string
}

const WEEKDAY_LETTERS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]
const INTERVAL_UNITS: Record<string, string> = {
  DAILY: "dni",
  WEEKLY: "tyg.",
  MONTHLY: "mies.",
  YEARLY: "lat",
}

const TASK_RECURRENCE = [
  { value: "none", label: "Nie powtarza się" },
  { value: "DAILY", label: "Codziennie" },
  { value: "WEEKDAYS", label: "Dni robocze" },
  { value: "WEEKLY", label: "Co tydzień" },
  { value: "MONTHLY", label: "Co miesiąc" },
]

function formFromOccurrence(occurrence: EventOccurrence): EventForm {
  const e = occurrence.event
  const { start, end } = eventMinutes(e)
  return {
    title: e.title,
    description: e.description || "",
    date: occurrence.date,
    endDate: e.allDay && occurrence.endDate !== occurrence.date ? occurrence.endDate : "",
    allDay: e.allDay,
    startTime: e.allDay ? "09:00" : minutesToTime(start),
    endTime: e.allDay ? "10:00" : minutesToTime(end),
    color: e.color ?? null,
    categoryId: e.categoryId || "",
    recurrenceRule: (e.recurrenceRule as Frequency) || "",
    recurrenceInterval: e.recurrenceInterval || 1,
    recurrenceDays: e.recurrenceDays?.length ? e.recurrenceDays : [weekdayOf(e.date)],
    recurrenceEnd: e.recurrenceEnd || "",
  }
}

function formFromDraft(draft: EventDraft): EventForm {
  return {
    title: "",
    description: "",
    date: draft.date,
    endDate: "",
    allDay: draft.allDay ?? false,
    startTime: draft.startTime || "09:00",
    endTime: draft.endTime || minutesToTime(timeToMinutes(draft.startTime || "09:00") + 60),
    color: null,
    categoryId: "",
    recurrenceRule: "",
    recurrenceInterval: 1,
    recurrenceDays: [weekdayOf(draft.date)],
    recurrenceEnd: "",
  }
}

function taskFormFromDraft(draft: EventDraft): TaskForm {
  // Same default as a new task in the schedule, or the length of the selected slot
  const duration =
    !draft.allDay && draft.startTime && draft.endTime
      ? timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime)
      : 25
  return {
    title: "",
    description: "",
    date: draft.date,
    time: draft.allDay ? "" : draft.startTime || "",
    plannedMinutes: String(duration > 0 ? duration : 25),
    categoryId: "",
    recurrenceRule: "none",
  }
}

export function EventDialog({ open, onOpenChange, draft, occurrence, categories, onSaved }: EventDialogProps) {
  const isEdit = !!occurrence
  const [kind, setKind] = useState<"event" | "task">("event")
  const [form, setForm] = useState<EventForm | null>(null)
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const workspace = useCalendarWorkspace()
  const { createEvent, updateEvent } = useCalendarEventActions()
  const revalidateTasks = useRevalidateTasks()
  const { mutate } = useSWRConfig()
  const { askScope, element: scopePrompt } = useScopePrompt()

  useIsomorphicLayoutEffect(() => {
    if (!open) return
    if (occurrence) {
      setKind("event")
      setForm(formFromOccurrence(occurrence))
      setTaskForm(null)
    } else if (draft) {
      setKind(draft.kind ?? "event")
      setForm(formFromDraft(draft))
      setTaskForm(taskFormFromDraft(draft))
    }
  }, [open, occurrence, draft])

  const category = useMemo(
    () => categories.find((c) => c.id === form?.categoryId) ?? null,
    [categories, form?.categoryId]
  )

  if (!form) return null

  const update = (patch: Partial<EventForm>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev))
  const updateTask = (patch: Partial<TaskForm>) => setTaskForm((prev) => (prev ? { ...prev, ...patch } : prev))

  const changeDate = (date: string) => {
    if (!isValidDay(date)) return update({ date })
    const patch: Partial<EventForm> = { date }
    // A weekly event on one day follows the date to its new weekday
    if (form.recurrenceDays.length === 1 && form.recurrenceDays[0] === weekdayOf(form.date)) {
      patch.recurrenceDays = [weekdayOf(date)]
    }
    if (form.endDate && form.endDate < date) patch.endDate = ""
    update(patch)
  }

  const changeStart = (startTime: string) => {
    if (!/^\d{2}:\d{2}$/.test(startTime)) return update({ startTime })
    const duration = Math.max(15, timeToMinutes(form.endTime) - timeToMinutes(form.startTime)) || 60
    update({ startTime, endTime: minutesToTime(timeToMinutes(startTime) + duration) })
  }

  const eventInput = (): CalendarEventInput => ({
    title: form.title.trim(),
    description: normalizeRichText(form.description),
    date: form.date,
    endDate: form.allDay && form.endDate ? form.endDate : null,
    allDay: form.allDay,
    startTime: form.allDay ? null : form.startTime,
    endTime: form.allDay ? null : form.endTime,
    color: form.color,
    categoryId: form.categoryId || null,
    recurrenceRule: form.recurrenceRule || null,
    recurrenceInterval: form.recurrenceInterval,
    recurrenceDays: form.recurrenceRule === "WEEKLY" ? form.recurrenceDays : [],
    recurrenceEnd: form.recurrenceRule && form.recurrenceEnd ? form.recurrenceEnd : null,
  })

  const saveEvent = async () => {
    if (!form.title.trim()) {
      toast.error("Dodaj tytuł wydarzenia")
      return
    }
    if (!isValidDay(form.date)) {
      toast.error("Wybierz datę")
      return
    }
    const input = eventInput()

    if (occurrence) {
      const event = occurrence.event
      let options: { scope?: "this" | "following" | "all"; occurrenceDate?: string } = {}
      if (event.recurrenceRule) {
        const recurrenceChanged =
          (input.recurrenceRule ?? null) !== (event.recurrenceRule ?? null) ||
          input.recurrenceInterval !== event.recurrenceInterval ||
          (input.recurrenceRule === "WEEKLY" &&
            [...(input.recurrenceDays ?? [])].sort().join() !==
              [...(event.recurrenceDays?.length ? event.recurrenceDays : [weekdayOf(event.date)])].sort().join()) ||
          (input.recurrenceEnd ?? null) !== (event.recurrenceEnd ?? null)
        const scope = await askScope("edit", { allowThis: !recurrenceChanged })
        if (!scope) return
        options = { scope, occurrenceDate: occurrence.date }
      }
      setIsSaving(true)
      try {
        await updateEvent(event, input, options)
        toast.success("Zapisano wydarzenie")
        onOpenChange(false)
        onSaved?.()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Nie udało się zapisać")
      } finally {
        setIsSaving(false)
      }
      return
    }

    setIsSaving(true)
    try {
      await createEvent(input)
      toast.success("Dodano wydarzenie")
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać")
    } finally {
      setIsSaving(false)
    }
  }

  const saveTask = async () => {
    if (!taskForm) return
    if (!taskForm.title.trim()) {
      toast.error("Dodaj tytuł zadania")
      return
    }
    const isRecurring = taskForm.recurrenceRule !== "none"
    setIsSaving(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: normalizeRichText(taskForm.description),
          scheduledDate: taskForm.date,
          scheduledTime: taskForm.time || null,
          plannedMinutes: parseInt(taskForm.plannedMinutes) || 25,
          categoryId: taskForm.categoryId || null,
          workspaceType: workspace,
          status: "NEW",
          isRecurring,
          recurrenceRule: isRecurring ? taskForm.recurrenceRule : null,
        }),
      })
      if (!res.ok) throw new Error()
      revalidateTasks()
      if (isRecurring) mutate((key) => typeof key === "string" && key.startsWith("/api/recurring"))
      toast.success("Dodano zadanie do harmonogramu")
      onOpenChange(false)
      onSaved?.()
    } catch {
      toast.error("Nie udało się dodać zadania")
    } finally {
      setIsSaving(false)
    }
  }

  const categorySelect = (value: string, onChange: (id: string) => void) => (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder="Bez kategorii" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-muted-foreground">Bez kategorii</span>
        </SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const autoColor = category?.color || DEFAULT_EVENT_COLOR
  const recurrenceText = form.recurrenceRule
    ? describeRecurrence({
        date: form.date,
        recurrenceRule: form.recurrenceRule,
        recurrenceInterval: form.recurrenceInterval,
        recurrenceDays: form.recurrenceDays,
        recurrenceEnd: form.recurrenceEnd || null,
      })
    : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edytuj wydarzenie" : kind === "task" ? "Nowe zadanie" : "Nowe wydarzenie"}</DialogTitle>
            <DialogDescription className="sr-only">
              {kind === "task" ? "Zadanie trafi do harmonogramu wybranego dnia" : "Wydarzenie w kalendarzu"}
            </DialogDescription>
          </DialogHeader>

          {!isEdit && (
            <div className="inline-flex w-fit rounded-lg bg-muted p-1 text-sm">
              {(
                [
                  { value: "event", label: "Wydarzenie", icon: CalendarDays },
                  { value: "task", label: "Zadanie", icon: CheckSquare },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                    kind === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {kind === "event" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void saveEvent()
              }}
            >
              <Input
                autoFocus={!isEdit}
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Dodaj tytuł"
                className="h-12 border-0 border-b rounded-none px-0 text-xl font-medium shadow-none focus-visible:ring-0 focus-visible:border-primary"
              />

              {/* When */}
              <div className="flex gap-3">
                <Clock className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => changeDate(e.target.value)}
                      className="h-9 w-auto"
                      aria-label="Data"
                    />
                    {form.allDay ? (
                      <>
                        <span className="text-sm text-muted-foreground">do</span>
                        <Input
                          type="date"
                          value={form.endDate || form.date}
                          min={form.date}
                          onChange={(e) => update({ endDate: e.target.value > form.date ? e.target.value : "" })}
                          className="h-9 w-auto"
                          aria-label="Data końca"
                        />
                      </>
                    ) : (
                      <>
                        <Input
                          type="time"
                          step={900}
                          value={form.startTime}
                          onChange={(e) => changeStart(e.target.value)}
                          className="h-9 w-[110px]"
                          aria-label="Początek"
                        />
                        <span className="text-sm text-muted-foreground">–</span>
                        <Input
                          type="time"
                          step={900}
                          value={form.endTime}
                          onChange={(e) => update({ endTime: e.target.value })}
                          className="h-9 w-[110px]"
                          aria-label="Koniec"
                        />
                      </>
                    )}
                  </div>
                  <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={form.allDay} onCheckedChange={(allDay) => update({ allDay })} />
                    Cały dzień
                  </label>
                </div>
              </div>

              {/* Repeat */}
              <div className="flex gap-3">
                <Repeat className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={form.recurrenceRule || "none"}
                      onValueChange={(v) =>
                        update({
                          recurrenceRule: v === "none" ? "" : (v as Frequency),
                          recurrenceInterval: 1,
                          recurrenceDays: [weekdayOf(form.date)],
                        })
                      }
                    >
                      <SelectTrigger className="h-9 w-[210px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nie powtarza się</SelectItem>
                        <SelectItem value="DAILY">Codziennie</SelectItem>
                        <SelectItem value="WEEKDAYS">W dni robocze (pon–pt)</SelectItem>
                        <SelectItem value="WEEKLY">Co tydzień</SelectItem>
                        <SelectItem value="MONTHLY">Co miesiąc</SelectItem>
                        <SelectItem value="YEARLY">Co roku</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.recurrenceRule && form.recurrenceRule !== "WEEKDAYS" && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">co</span>
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={form.recurrenceInterval}
                          onChange={(e) =>
                            update({ recurrenceInterval: Math.max(1, Math.min(99, parseInt(e.target.value) || 1)) })
                          }
                          className="h-9 w-16"
                          aria-label="Co ile"
                        />
                        <span className="text-muted-foreground">{INTERVAL_UNITS[form.recurrenceRule]}</span>
                      </div>
                    )}
                  </div>

                  {form.recurrenceRule === "WEEKLY" && (
                    <div className="flex gap-1">
                      {WEEKDAY_LETTERS.map((letter, day) => {
                        const active = form.recurrenceDays.includes(day)
                        return (
                          <button
                            key={day}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              const next = active
                                ? form.recurrenceDays.filter((d) => d !== day)
                                : [...form.recurrenceDays, day]
                              if (next.length > 0) update({ recurrenceDays: next })
                            }}
                            className={cn(
                              "h-8 w-8 rounded-full text-xs font-medium transition-colors",
                              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                            )}
                          >
                            {letter}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {form.recurrenceRule && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Kończy się</span>
                      <Input
                        type="date"
                        value={form.recurrenceEnd}
                        min={form.date}
                        onChange={(e) => update({ recurrenceEnd: e.target.value })}
                        className="h-9 w-auto"
                        aria-label="Koniec powtarzania"
                      />
                      {form.recurrenceEnd ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => update({ recurrenceEnd: "" })}
                        >
                          nigdy
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">(puste = nigdy)</span>
                      )}
                    </div>
                  )}
                  {recurrenceText && <p className="text-xs text-muted-foreground">{recurrenceText}</p>}
                </div>
              </div>

              {/* Category and color */}
              <div className="flex gap-3">
                <Tag className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="w-full max-w-[260px]">{categorySelect(form.categoryId, (categoryId) => update({ categoryId }))}</div>
              </div>
              <div className="flex gap-3">
                <Palette className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    title={category ? "Kolor kategorii" : "Domyślny"}
                    onClick={() => update({ color: null })}
                    className={cn(
                      "flex h-7 items-center gap-1 rounded-full border px-2 text-xs",
                      form.color === null && "ring-2 ring-offset-1 ring-primary"
                    )}
                  >
                    <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: autoColor }} />
                    Auto
                  </button>
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      onClick={() => update({ color: c.value })}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full",
                        form.color === c.value && "ring-2 ring-offset-1 ring-primary"
                      )}
                      style={{ backgroundColor: c.value }}
                    >
                      {form.color === c.value && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Opis / plan</Label>
                <DescriptionField
                  value={form.description}
                  onChange={(description) => update({ description })}
                  placeholder="Agenda, notatki, plan, checklista…"
                  title={form.title || "Wydarzenie"}
                  subtitle="Opis wydarzenia · zapisze się po kliknięciu „Zapisz”"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Anuluj
                </Button>
                <Button type="submit" disabled={isSaving || !form.title.trim()}>
                  {isSaving ? "Zapisywanie…" : "Zapisz"}
                </Button>
              </div>
            </form>
          ) : (
            taskForm && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveTask()
                }}
              >
                <Input
                  autoFocus
                  value={taskForm.title}
                  onChange={(e) => updateTask({ title: e.target.value })}
                  placeholder="Dodaj tytuł zadania"
                  className="h-12 border-0 border-b rounded-none px-0 text-xl font-medium shadow-none focus-visible:ring-0 focus-visible:border-primary"
                />
                <div className="flex gap-3">
                  <Clock className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={taskForm.date}
                      onChange={(e) => updateTask({ date: e.target.value })}
                      className="h-9 w-auto"
                      aria-label="Data"
                    />
                    <Input
                      type="time"
                      step={900}
                      value={taskForm.time}
                      onChange={(e) => updateTask({ time: e.target.value })}
                      className="h-9 w-[110px]"
                      aria-label="Godzina (opcjonalnie)"
                    />
                    <div className="flex items-center gap-1.5 text-sm">
                      <Input
                        type="number"
                        min={5}
                        step={5}
                        value={taskForm.plannedMinutes}
                        onChange={(e) => updateTask({ plannedMinutes: e.target.value })}
                        className="h-9 w-20"
                        aria-label="Planowany czas w minutach"
                      />
                      <span className="text-muted-foreground">min</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Repeat className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <Select value={taskForm.recurrenceRule} onValueChange={(recurrenceRule) => updateTask({ recurrenceRule })}>
                    <SelectTrigger className="h-9 w-[210px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_RECURRENCE.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Tag className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="w-full max-w-[260px]">
                    {categorySelect(taskForm.categoryId, (categoryId) => updateTask({ categoryId }))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Opis</Label>
                  <DescriptionField
                    value={taskForm.description}
                    onChange={(description) => updateTask({ description })}
                    placeholder="Plan, notatki, checklista…"
                    title={taskForm.title || "Zadanie"}
                    subtitle="Opis zadania · zapisze się po kliknięciu „Dodaj zadanie”"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Zadanie trafi do harmonogramu tego dnia — tam uruchomisz timer i odhaczysz je jako zrobione.
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Anuluj
                  </Button>
                  <Button type="submit" disabled={isSaving || !taskForm.title.trim()}>
                    {isSaving ? "Dodawanie…" : "Dodaj zadanie"}
                  </Button>
                </div>
              </form>
            )
          )}
        </DialogContent>
      </Dialog>
      {scopePrompt}
    </>
  )
}
