"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Calendar, Check, ExternalLink, FileText, Link2, RotateCcw, Search, StickyNote, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { AutosaveRichText } from "@/components/editor/autosave-rich-text"
import { SubtaskList } from "@/components/tasks/subtask-list"
import type { GoalTaskActions } from "@/hooks/use-goal-tasks"
import type { Note } from "@/hooks/use-notes"
import { htmlToPlainText, noteTitleFrom } from "@/lib/rich-text"
import { taskDayKey, type GoalTaskItem } from "@/lib/quarters"
import { cn } from "@/lib/utils"
import { dayLabel, scheduleTaskHref, TaskDayPicker } from "./task-day-picker"

const PICKER_LIMIT = 8

// Same key as the Notatki page uses, so the list is shared
const notesKey = (q: string) => {
  const params = new URLSearchParams({ workspace: "WORK" })
  if (q.trim()) params.set("q", q.trim())
  return `/api/notes?${params.toString()}`
}

function NotePicker({ onPick, onCancel }: { onPick: (note: Note) => void; onCancel: () => void }) {
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const { data: notes, isLoading } = useSWR<Note[]>(notesKey(search), { keepPreviousData: true })

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(query), 250)
    return () => clearTimeout(timeout)
  }, [query])

  const shown = (notes ?? []).slice(0, PICKER_LIMIT)

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj w Notatkach…"
            className="h-8 pl-8 text-sm"
            autoFocus
            aria-label="Szukaj notatki"
          />
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCancel} aria-label="Anuluj">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="max-h-60 space-y-0.5 overflow-y-auto">
        {shown.map((note) => {
          const text = htmlToPlainText(note.content).replace(/\s+/g, " ").trim()
          return (
            <button
              key={note.id}
              type="button"
              onClick={() => onPick(note)}
              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
            >
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{noteTitleFrom(note.title, note.content)}</span>
                {text && <span className="block truncate text-xs text-muted-foreground">{text}</span>}
              </span>
            </button>
          )
        })}
        {notes && shown.length === 0 && (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            {search ? "Brak notatek z tym tekstem" : "Nie masz jeszcze notatek"}
          </p>
        )}
        {!notes && isLoading && <p className="px-2 py-3 text-center text-sm text-muted-foreground">Ładowanie…</p>}
      </div>
    </div>
  )
}

function LinkedNote({ task, actions }: { task: GoalTaskItem; actions: GoalTaskActions }) {
  const [picking, setPicking] = useState(false)

  if (task.linkedNote) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2.5">
        <FileText className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.linkedNote.title}</span>
        <div className="flex shrink-0 gap-1">
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href={`/notes?note=${encodeURIComponent(task.linkedNote.id)}`} prefetch={false}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Otwórz
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => actions.linkNote(task, null)}>
            Odepnij
          </Button>
        </div>
      </div>
    )
  }

  if (picking) {
    return (
      <NotePicker
        onCancel={() => setPicking(false)}
        onPick={(note) => {
          setPicking(false)
          actions.linkNote(task, { id: note.id, title: noteTitleFrom(note.title, note.content) })
        }}
      />
    )
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
      <Link2 className="mr-1.5 h-4 w-4" />
      Podepnij notatkę z Notatek
    </Button>
  )
}

function TitleField({ task, actions }: { task: GoalTaskItem; actions: GoalTaskActions }) {
  const [value, setValue] = useState(task.title)
  useEffect(() => setValue(task.title), [task.title])

  const commit = () => {
    if (value.trim()) actions.rename(task, value)
    else setValue(task.title)
  }

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === "Escape") setValue(task.title)
      }}
      className={cn(
        "h-auto border-transparent px-1 py-1 text-lg font-semibold shadow-none hover:border-input focus-visible:border-input",
        task.status === "COMPLETED" && "text-muted-foreground line-through"
      )}
      aria-label="Nazwa zadania"
    />
  )
}

/** Task of a goal: name, done, day in Harmonogram, its note, a note pinned from Notatki, checklist */
export function GoalTaskDialog({
  task,
  contextLabel,
  actions,
  onOpenChange,
}: {
  task: GoalTaskItem | null
  contextLabel?: string
  actions: GoalTaskActions
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={task !== null} onOpenChange={onOpenChange}>
      {/* Nothing focused on open - on a phone the keyboard would cover the task */}
      <DialogContent className="gap-5 sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        {task && <GoalTaskDetails task={task} contextLabel={contextLabel} actions={actions} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function GoalTaskDetails({
  task,
  contextLabel,
  actions,
  onClose,
}: {
  task: GoalTaskItem
  contextLabel?: string
  actions: GoalTaskActions
  onClose: () => void
}) {
  const done = task.status === "COMPLETED"
  const dayKey = taskDayKey(task)

  const remove = () => {
    if (!window.confirm(`Usunąć zadanie „${task.title}”?`)) return
    onClose()
    actions.remove(task)
  }

  return (
    <>
      <DialogHeader className="space-y-1 pr-6 text-left">
        <DialogTitle className="sr-only">{task.title}</DialogTitle>
        <DialogDescription className={cn("px-1 text-xs", !contextLabel && "sr-only")}>
          {contextLabel ?? "Zadanie celu"}
        </DialogDescription>
        <TitleField task={task} actions={actions} />
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => actions.toggle(task)}>
          {done ? <RotateCcw className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4 text-emerald-600" />}
          {done ? "Przywróć" : "Zrobione"}
        </Button>
        <TaskDayPicker dayKey={dayKey} onSelect={(key) => actions.schedule(task, key)} taskId={task.id} align="start">
          <Button type="button" variant="outline" size="sm" className={cn(dayKey && "border-primary/40 text-primary")}>
            <Calendar className="mr-1.5 h-4 w-4" />
            {dayKey ? `W harmonogramie: ${dayLabel(dayKey)}` : "Zaplanuj w harmonogramie"}
          </Button>
        </TaskDayPicker>
        {dayKey && (
          <Button asChild variant="ghost" size="sm">
            <Link href={scheduleTaskHref(dayKey, task.id)} prefetch={false}>
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Otwórz
            </Link>
          </Button>
        )}
      </div>

      <section className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <StickyNote className="h-3.5 w-3.5" />
          Notatka zadania
          <span className="font-normal">· widać ją też w Notatkach („Z zadań”)</span>
        </h3>
        <AutosaveRichText
          key={task.id}
          value={task.description}
          onSave={(html) => actions.saveNote(task, html)}
          placeholder="Ustalenia, linki, kolejne kroki…"
          title={task.title}
          subtitle="Notatka zadania"
          taskSource={{ kind: "task", id: task.id }}
        />
      </section>

      <section className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          Podpięta notatka
        </h3>
        <LinkedNote task={task} actions={actions} />
      </section>

      <section className="space-y-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">Lista kontrolna</h3>
        <SubtaskList
          taskId={task.id}
          subtasks={task.subtasks}
          onSubtasksChange={(subtasks) => actions.setLocal(task.id, { subtasks })}
        />
      </section>

      <div className="flex justify-between border-t pt-3">
        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={remove}>
          <Trash2 className="mr-1.5 h-4 w-4" />
          Usuń zadanie
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Gotowe
        </Button>
      </div>
    </>
  )
}
