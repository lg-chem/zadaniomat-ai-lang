"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { differenceInDays, format, formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { CheckCircle2, Circle, Loader2, Pin, Play, Plus, Search, StickyNote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotePanel, noteDisplayTitle } from "@/components/notes/note-panel"
import { TaskNotePanel } from "@/components/notes/task-note-panel"
import {
  CreateTaskFromNoteDialog,
  type TaskFromNoteDraft,
} from "@/components/notes/create-task-from-note-dialog"
import { useNoteActions, useNotes, useTaskNotes, type Note, type TaskNote } from "@/hooks/use-notes"
import { useCategories } from "@/hooks/use-categories"
import { useTimerStore } from "@/stores/timer-store"
import { htmlToPlainText, plainTextToHtml } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

type Filter = "all" | "notes" | "tasks"
type FeedItem =
  | { kind: "note"; id: string; date: string; note: Note }
  | { kind: "task"; id: string; date: string; task: TaskNote }
type Selected = { kind: "note"; id: string } | { kind: "task"; id: string } | null

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Wszystko" },
  { value: "notes", label: "Notatki" },
  { value: "tasks", label: "Z zadań" },
]

function whenLabel(date: string) {
  const d = new Date(date)
  if (differenceInDays(new Date(), d) < 7) return formatDistanceToNow(d, { addSuffix: true, locale: pl })
  return format(d, "d MMM yyyy", { locale: pl })
}

function snippet(html: string | null | undefined, skipFirstLine = false) {
  const lines = htmlToPlainText(html).split("\n").map((l) => l.trim()).filter(Boolean)
  return (skipFirstLine ? lines.slice(1) : lines).join("  ")
}

const isDesktop = () => typeof window !== "undefined" && window.innerWidth >= 1024

export default function NotesPage() {
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Selected>(null)
  const [newNoteId, setNewNoteId] = useState<string | null>(null)
  const [capture, setCapture] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [taskDraft, setTaskDraft] = useState<TaskFromNoteDraft | null>(null)
  // Keeps the open item on screen when a search hides it from the list
  const lastSelected = useRef<FeedItem | null>(null)

  const { notes, isLoading: notesLoading } = useNotes(search)
  const { taskNotes, isLoading: tasksLoading } = useTaskNotes(search)
  const { categories } = useCategories()
  const { createNote } = useNoteActions()
  const timerTaskId = useTimerStore((s) => (s.isRunning ? s.taskId : null))
  const timerPaused = useTimerStore((s) => s.isPaused)

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(query), 300)
    return () => clearTimeout(timeout)
  }, [query])

  const feed = useMemo(() => {
    const items: FeedItem[] = []
    if (filter !== "tasks") {
      for (const note of notes) items.push({ kind: "note", id: note.id, date: note.updatedAt, note })
    }
    if (filter !== "notes") {
      for (const task of taskNotes) {
        items.push({ kind: "task", id: task.id, date: task.descriptionUpdatedAt ?? task.updatedAt, task })
      }
    }
    const pinned = (item: FeedItem) => (item.kind === "note" && item.note.isPinned ? 1 : 0)
    return items.sort((a, b) => pinned(b) - pinned(a) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [notes, taskNotes, filter])

  const current = useMemo(() => {
    if (!selected) return null
    const fresh = feed.find((item) => item.kind === selected.kind && item.id === selected.id) ?? null
    if (fresh) lastSelected.current = fresh
    else if (lastSelected.current?.kind !== selected.kind || lastSelected.current?.id !== selected.id) return null
    return fresh ?? lastSelected.current
  }, [feed, selected])

  // On a wide screen open the newest item right away
  useEffect(() => {
    if (!selected && feed.length > 0 && isDesktop()) setSelected({ kind: feed[0].kind, id: feed[0].id })
  }, [feed, selected])

  const addNote = async (text?: string) => {
    const lines = (text ?? "").split("\n")
    const title = (lines[0] ?? "").trim().slice(0, 300)
    const rest = lines.slice(1).join("\n").trim()
    try {
      const note = await createNote({ title, content: rest ? plainTextToHtml(rest) : null })
      lastSelected.current = { kind: "note", id: note.id, date: note.updatedAt, note }
      setSelected({ kind: "note", id: note.id })
      if (!text) setNewNoteId(note.id)
      return note
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać notatki")
      return null
    }
  }

  const submitCapture = async () => {
    const text = capture.trim()
    if (!text || isCapturing) return
    // Clear right away so the next note can be typed while this one saves
    setCapture("")
    setIsCapturing(true)
    const note = await addNote(text)
    if (note) toast.success("Zapisano notatkę")
    else setCapture((current) => (current ? `${text}\n${current}` : text))
    setIsCapturing(false)
  }

  const isLoading = (notesLoading || tasksLoading) && feed.length === 0

  return (
    <div className="flex h-[calc(100dvh-8.75rem)] min-h-[520px] flex-col gap-3 animate-fade-in md:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <StickyNote className="h-7 w-7 text-amber-500" />
            Notatki
          </h1>
          <p className="text-sm text-muted-foreground">Twoje notatki i opisy zadań w jednym miejscu</p>
        </div>
        <Button onClick={() => addNote()}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nowa notatka
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* List */}
        <aside className={cn("flex min-h-0 w-full shrink-0 flex-col gap-3 lg:w-[380px]", current && "hidden lg:flex")}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj w notatkach i opisach…"
              className="pl-9"
            />
          </div>

          <div className="inline-flex w-fit rounded-md border p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded px-3 py-1 text-sm font-medium transition-colors",
                  filter === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Quick capture */}
          <div className="rounded-lg border bg-amber-50/60 p-2 focus-within:ring-2 focus-within:ring-amber-300/60 dark:bg-amber-950/20">
            <textarea
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void submitCapture()
                }
              }}
              rows={capture.includes("\n") ? 4 : 2}
              placeholder="Zanotuj coś szybko… (Enter – zapisz, Shift+Enter – nowa linia)"
              className="w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            {capture.trim() && (
              <div className="flex justify-end">
                <Button size="sm" className="h-7" onClick={submitCapture} disabled={isCapturing}>
                  Zapisz notatkę
                </Button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2 pr-1">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && feed.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {search
                  ? "Nic nie znaleziono."
                  : "Tu zobaczysz swoje notatki i opisy zadań, najnowsze na górze. Zanotuj coś w polu wyżej."}
              </div>
            )}
            {feed.map((item) => {
              const isSelected = current?.kind === item.kind && current.id === item.id
              const base = cn(
                "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                isSelected && "border-primary/60 bg-primary/5 hover:bg-primary/5"
              )

              if (item.kind === "note") {
                const note = item.note
                const hasTitle = !!note.title.trim()
                return (
                  <button key={`note-${note.id}`} type="button" className={base} onClick={() => setSelected({ kind: "note", id: note.id })}>
                    <div className="flex items-center gap-2">
                      <StickyNote className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="truncate font-medium">{noteDisplayTitle(note)}</span>
                      {note.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{whenLabel(item.date)}</span>
                    </div>
                    {snippet(note.content, !hasTitle) && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{snippet(note.content, !hasTitle)}</p>
                    )}
                  </button>
                )
              }

              const task = item.task
              const done = task.status === "COMPLETED"
              const color = task.category?.color || "#64748b"
              const running = timerTaskId === task.id
              return (
                <button key={`task-${task.id}`} type="button" className={base} onClick={() => setSelected({ kind: "task", id: task.id })}>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color }} />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0" style={{ color }} />
                    )}
                    <span className={cn("truncate font-medium", done && "text-muted-foreground line-through")}>{task.title}</span>
                    {running && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        <Play className={cn("h-2.5 w-2.5", !timerPaused && "animate-pulse")} />
                        {timerPaused ? "pauza" : "trwa"}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{whenLabel(item.date)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{snippet(task.description)}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">Zadanie</span>
                    {task.category && <span style={{ color }}>{task.category.name}</span>}
                    {task.scheduledDate && <span>{format(new Date(`${task.scheduledDate.slice(0, 10)}T12:00:00`), "d MMM", { locale: pl })}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Open item */}
        <main className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border bg-background", !current && "hidden lg:block")}>
          {current?.kind === "note" && (
            <NotePanel
              key={current.note.id}
              note={current.note}
              autoFocusTitle={newNoteId === current.note.id}
              onBack={() => setSelected(null)}
              onDeleted={() => {
                lastSelected.current = null
                setSelected(null)
              }}
              onCreateTask={setTaskDraft}
            />
          )}
          {current?.kind === "task" && (
            <TaskNotePanel key={current.task.id} task={current.task} onBack={() => setSelected(null)} />
          )}
          {!current && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <StickyNote className="h-10 w-10 opacity-40" />
              <p className="text-sm">Wybierz notatkę z listy albo zapisz nową.</p>
            </div>
          )}
        </main>
      </div>

      <CreateTaskFromNoteDialog draft={taskDraft} onClose={() => setTaskDraft(null)} categories={categories} />
    </div>
  )
}
