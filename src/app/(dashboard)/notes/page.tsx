"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { differenceInDays, format, formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { CheckCircle2, Circle, CloudOff, Loader2, Pin, Play, Plus, Search, Share2, StickyNote, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotePanel, noteDisplayTitle } from "@/components/notes/note-panel"
import { TaskNotePanel } from "@/components/notes/task-note-panel"
import { useNoteActions, useNotes, useTaskNotes, type Note, type TaskNote } from "@/hooks/use-notes"
import { useTimerStore } from "@/stores/timer-store"
import { useNoteOutboxStore } from "@/lib/note-outbox"
import { useOnline } from "@/hooks/use-online"
import { useIsCompactScreen, useIsTouch } from "@/hooks/use-media-query"
import { useVisualViewport } from "@/hooks/use-visual-viewport"
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

// The open item is kept in the address (?note= / ?taskNote=): links open it,
// and on a phone Android's back gesture closes it instead of leaving Notes
function selectionFromUrl(): Selected {
  const params = new URLSearchParams(window.location.search)
  const note = params.get("note")
  if (note) return { kind: "note", id: note }
  const task = params.get("taskNote")
  if (task) return { kind: "task", id: task }
  return null
}

const selectionUrl = (item: NonNullable<Selected>) =>
  `/notes?${item.kind === "note" ? "note" : "taskNote"}=${encodeURIComponent(item.id)}`

// Text shared to the app from another one (Android "Udostępnij" → Zadaniomat)
function sharedText(params: URLSearchParams) {
  const title = params.get("title")?.trim()
  const text = params.get("text")?.trim()
  const url = params.get("url")?.trim()
  const parts: string[] = []
  if (title && title !== text) parts.push(title)
  if (text) parts.push(text)
  if (url && !text?.includes(url)) parts.push(url)
  return parts.join("\n")
}

export default function NotesPage() {
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Selected>(null)
  const [newNoteId, setNewNoteId] = useState<string | null>(null)
  const [capture, setCapture] = useState("")
  const [isShared, setIsShared] = useState(false)
  // Keeps the open item on screen when a search hides it from the list
  const lastSelected = useRef<FeedItem | null>(null)
  const captureRef = useRef<HTMLTextAreaElement>(null)
  // An open note added its own entry to the history (phone) - closing goes back over it
  const pushedEntry = useRef(false)

  const { notes, isLoading: notesLoading } = useNotes(search)
  const { taskNotes, isLoading: tasksLoading } = useTaskNotes(search)
  const { createNote } = useNoteActions()
  const timerTaskId = useTimerStore((s) => (s.isRunning ? s.taskId : null))
  const timerPaused = useTimerStore((s) => s.isPaused)
  const online = useOnline()
  const waitingCount = useNoteOutboxStore((s) => s.entries.length)
  const syncResult = useNoteOutboxStore((s) => s.lastResult)
  const isCompact = useIsCompactScreen()
  const isTouch = useIsTouch()

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(query), 300)
    return () => clearTimeout(timeout)
  }, [query])

  // Item from the address (a link, or back / forward), and text shared from another app
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = sharedText(params)
    if (shared) {
      setCapture(shared)
      setIsShared(true)
      window.history.replaceState(null, "", "/notes")
      setTimeout(() => captureRef.current?.focus(), 150)
    } else {
      setSelected(selectionFromUrl())
    }

    const handlePopState = () => {
      pushedEntry.current = false
      setSelected(selectionFromUrl())
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const openItem = useCallback((item: NonNullable<Selected>) => {
    setSelected(item)
    const url = selectionUrl(item)
    if (isDesktop() || pushedEntry.current) {
      window.history.replaceState(null, "", url)
    } else {
      window.history.pushState(null, "", url)
      pushedEntry.current = true
    }
  }, [])

  const closeItem = useCallback(() => {
    // Same as the phone's back gesture - the history stays as it was
    if (pushedEntry.current) {
      window.history.back()
      return
    }
    setSelected(null)
    window.history.replaceState(null, "", "/notes")
  }, [])

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

  // Phone: the open note covers the whole screen, sized to the space above the keyboard
  const isFullScreen = isCompact && !!current
  const viewport = useVisualViewport(isFullScreen)
  useEffect(() => {
    if (!isFullScreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [isFullScreen])

  // Shown and opened right away - saving goes on in the background
  const addNote = async (text?: string, { open = true }: { open?: boolean } = {}) => {
    const lines = (text ?? "").split("\n")
    const title = (lines[0] ?? "").trim().slice(0, 300)
    const rest = lines.slice(1).join("\n").trim()
    const note = await createNote({ title, content: rest ? plainTextToHtml(rest) : null })
    lastSelected.current = { kind: "note", id: note.id, date: note.updatedAt, note }
    if (!text) setNewNoteId(note.id)
    if (open) openItem({ kind: "note", id: note.id })
    return note
  }

  const submitCapture = async () => {
    const text = capture.trim()
    if (!text) return
    // Clear right away so the next note can be typed while this one saves
    setCapture("")
    setIsShared(false)
    // Phone: stay in the list with the keyboard open - many short notes in a row
    const stay = isCompact
    const note = await addNote(text, { open: !stay })
    if (stay) captureRef.current?.focus()
    toast.success(note.pending ? "Zapisano na telefonie - wyślę, gdy będzie internet" : "Zapisano notatkę", {
      ...(stay && { action: { label: "Otwórz", onClick: () => openItem({ kind: "note", id: note.id }) } }),
    })
  }

  const isLoading = (notesLoading || tasksLoading) && feed.length === 0

  const panel = current?.kind === "note" ? (
    <NotePanel
      key={current.note.id}
      note={current.note}
      layout={isCompact ? "screen" : "pane"}
      autoFocusTitle={newNoteId === current.note.id}
      discardIfEmpty={newNoteId === current.note.id}
      onBack={closeItem}
      onDeleted={() => {
        lastSelected.current = null
        closeItem()
      }}
    />
  ) : current?.kind === "task" ? (
    <TaskNotePanel key={current.task.id} task={current.task} onBack={closeItem} />
  ) : null

  return (
    <div className="flex flex-col gap-3 pb-24 animate-fade-in lg:h-[calc(100dvh-4rem)] lg:min-h-[520px] lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <StickyNote className="h-6 w-6 text-amber-500 md:h-7 md:w-7" />
            Notatki
          </h1>
          <p className="hidden text-sm text-muted-foreground sm:block">Twoje notatki i opisy zadań w jednym miejscu</p>
        </div>
        <Button onClick={() => addNote()} className="h-10 shrink-0">
          <Plus className="mr-1.5 h-4 w-4" />
          Nowa notatka
        </Button>
      </div>

      {/* Without internet notes are kept on the device and sent later */}
      {(!online || waitingCount > 0) && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm",
            !online || syncResult === "auth"
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
          )}
        >
          {online ? (
            <Loader2 className={cn("mt-0.5 h-4 w-4 shrink-0", syncResult !== "auth" && syncResult !== "error" && "animate-spin")} />
          ) : (
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {!online
              ? `Brak internetu. Notatki zapisują się na telefonie i wyślą same, gdy wróci połączenie${
                  waitingCount > 0 ? ` (czeka: ${waitingCount})` : ""
                }.`
              : syncResult === "auth"
                ? `Zaloguj się ponownie, żeby wysłać notatki zapisane bez internetu (czeka: ${waitingCount}).`
                : syncResult === "error"
                  ? `Serwer nie odpowiada - spróbuję wysłać notatki jeszcze raz (czeka: ${waitingCount}).`
                  : `Wysyłam notatki zapisane bez internetu (czeka: ${waitingCount})…`}
          </span>
        </div>
      )}

      <div className="flex gap-4 lg:min-h-0 lg:flex-1">
        {/* List */}
        <aside className="flex w-full shrink-0 flex-col gap-3 lg:min-h-0 lg:w-[380px]">
          {/* Quick capture - first thing on the page */}
          <div className="rounded-xl border bg-amber-50/60 p-2 focus-within:ring-2 focus-within:ring-amber-300/60 dark:bg-amber-950/20">
            {isShared && (
              <div className="mb-1 flex items-center gap-1 px-1 text-xs text-amber-800 dark:text-amber-300">
                <Share2 className="h-3.5 w-3.5" />
                Udostępnione z innej aplikacji - dopisz coś i zapisz
              </div>
            )}
            <textarea
              ref={captureRef}
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              onKeyDown={(e) => {
                // On a phone Enter makes a new line - there's a button to save
                if (e.key === "Enter" && !e.shiftKey && !isTouch) {
                  e.preventDefault()
                  void submitCapture()
                }
              }}
              rows={2}
              enterKeyHint={isTouch ? "enter" : "send"}
              placeholder={isTouch ? "Zanotuj coś…" : "Zanotuj coś szybko… (Enter – zapisz, Shift+Enter – nowa linia)"}
              aria-label="Szybka notatka"
              className="block max-h-[40vh] min-h-[3.25rem] w-full resize-none bg-transparent px-1 py-1 text-base outline-none [field-sizing:content] placeholder:text-muted-foreground lg:text-sm"
            />
            {capture.trim() && (
              <div className="mt-1 flex items-center gap-2">
                <span className="mr-auto px-1 text-xs text-muted-foreground">Pierwsza linia to tytuł</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 text-muted-foreground"
                  // Keeps the keyboard open
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setCapture("")
                    setIsShared(false)
                  }}
                  aria-label="Wyczyść"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button className="h-10 px-5" onMouseDown={(e) => e.preventDefault()} onClick={submitCapture}>
                  Zapisz
                </Button>
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj w notatkach i opisach…"
              className="h-10 pl-9 text-base lg:text-sm"
            />
          </div>

          <div className="inline-flex w-fit rounded-md border p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Phone: the page scrolls; wide screen: the list scrolls next to the open item */}
          <div className="space-y-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-2 lg:pr-1">
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
              const isSelected = !isCompact && current?.kind === item.kind && current.id === item.id
              const base = cn(
                "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted",
                isSelected && "border-primary/60 bg-primary/5 hover:bg-primary/5"
              )

              if (item.kind === "note") {
                const note = item.note
                const hasTitle = !!note.title.trim()
                return (
                  <button key={`note-${note.id}`} type="button" className={base} onClick={() => openItem({ kind: "note", id: note.id })}>
                    <div className="flex items-center gap-2">
                      <StickyNote className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="truncate font-medium">{noteDisplayTitle(note)}</span>
                      {note.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      {note.pending && (
                        <span title="Czeka na wysłanie - zapisana na tym urządzeniu">
                          <CloudOff className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        </span>
                      )}
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
                <button key={`task-${task.id}`} type="button" className={base} onClick={() => openItem({ kind: "task", id: task.id })}>
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

        {/* Open item - wide screen: next to the list */}
        {!isCompact && (
          <main className="hidden min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border bg-background lg:block">
            {panel ?? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <StickyNote className="h-10 w-10 opacity-40" />
                <p className="text-sm">Wybierz notatkę z listy albo zapisz nową.</p>
              </div>
            )}
          </main>
        )}
      </div>

      {/* Phone: the open item over the whole screen, above the menus and floating buttons */}
      {isFullScreen &&
        createPortal(
          <div
            className="fixed inset-x-0 top-0 z-50 bg-background"
            style={{ top: viewport?.offsetTop ?? 0, height: viewport?.height ?? "100dvh" }}
          >
            {current?.kind === "task" ? (
              <div className="h-full overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{panel}</div>
            ) : (
              panel
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
