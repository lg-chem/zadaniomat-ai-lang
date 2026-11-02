"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { Editor } from "@tiptap/react"
import { formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { ArrowLeft, Check, CheckCircle2, Circle, CloudOff, ListPlus, Loader2, MoreVertical, Pin, PinOff, Trash2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AutosaveRichText } from "@/components/editor/autosave-rich-text"
import { EditorToolbar } from "@/components/editor/editor-toolbar"
import type { SaveStatus } from "@/components/editor/document-editor-dialog"
import { useTaskFromText } from "@/components/tasks/create-task-from-text-dialog"
import { useNoteActions, useNoteDetail, type Note } from "@/hooks/use-notes"
import { htmlToPlainText } from "@/lib/rich-text"
import { formatDayShort } from "@/lib/task-recurrence"
import { cn } from "@/lib/utils"

interface NotePanelProps {
  note: Note
  onBack: () => void
  onDeleted: () => void
  autoFocusTitle?: boolean
  // screen - the whole phone screen: bar with back and menu on top,
  // formatting buttons at the bottom, right above the keyboard
  layout?: "pane" | "screen"
  // A note just made with "Nowa notatka": left empty, it's removed on closing
  discardIfEmpty?: boolean
}

// One status for the title and the text, e.g. "Zapisano"
function combinedStatus(a: SaveStatus, b: SaveStatus): SaveStatus {
  if (a === "error" || b === "error") return "error"
  if (a === "saving" || b === "saving") return "saving"
  if (a === "saved" || b === "saved") return "saved"
  return "idle"
}

const TITLE_SAVE_DELAY = 800

export function noteDisplayTitle(note: Pick<Note, "title" | "content">): string {
  if (note.title.trim()) return note.title
  const firstLine = htmlToPlainText(note.content).split("\n").find((line) => line.trim())
  return firstLine?.replace(/^[•☐☑]\s*/, "").slice(0, 120) || "Bez tytułu"
}

// One note: title, text with formatting (saved automatically), tasks made from it
export function NotePanel({ note, onBack, onDeleted, autoFocusTitle, layout = "pane", discardIfEmpty }: NotePanelProps) {
  const { updateNote, deleteNote } = useNoteActions()
  // A note not sent yet isn't on the server - nothing to ask about
  const { note: detail } = useNoteDetail(note.pending ? null : note.id)
  const [title, setTitle] = useState(note.title)
  const [editor, setEditor] = useState<Editor | null>(null)
  const taskSource = useMemo(() => ({ kind: "note" as const, id: note.id }), [note.id])
  const taskFromText = useTaskFromText(editor, taskSource)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTitle = useRef<string | null>(null)
  const [titleStatus, setTitleStatus] = useState<SaveStatus>("idle")
  const [contentStatus, setContentStatus] = useState<SaveStatus>("idle")

  const saveTitle = useCallback(async () => {
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = null
    const next = pendingTitle.current
    pendingTitle.current = null
    if (next === null) return
    setTitleStatus("saving")
    try {
      await updateNote(note.id, { title: next })
      setTitleStatus("saved")
    } catch {
      setTitleStatus("error")
      toast.error("Nie udało się zapisać tytułu")
    }
  }, [note.id, updateNote])

  // Save a title typed just before switching to another note
  useEffect(() => () => void saveTitle(), [saveTitle])

  // Whether anything was written - read when the note closes, the editor may be gone by then
  const titleRef = useRef(note.title)
  titleRef.current = title
  const textEmpty = useRef(!htmlToPlainText(note.content).trim())
  useEffect(() => {
    if (!editor) return
    const update = () => {
      textEmpty.current = editor.isEmpty
    }
    editor.on("update", update)
    return () => {
      editor.off("update", update)
    }
  }, [editor])

  // "Nowa notatka" opened and closed without writing - don't keep an empty note
  const discardRef = useRef(discardIfEmpty)
  discardRef.current = discardIfEmpty
  useEffect(
    () => () => {
      if (discardRef.current && !titleRef.current.trim() && textEmpty.current) {
        deleteNote(note.id).catch(() => {})
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note.id]
  )

  const saveContent = useCallback(
    async (content: string | null) => {
      await updateNote(note.id, { content })
    },
    [note.id, updateNote]
  )

  // Selected fragment (linked in the text), otherwise the whole note
  const handleCreateTask = () => {
    if (note.pending) {
      toast.info("Zadanie zrobisz z tej notatki, gdy się wyśle - potrzebny internet")
      return
    }
    taskFromText.start?.({
      whole: { title: noteDisplayTitle({ title, content: note.content }), description: note.content },
    })
  }

  const handleDelete = async () => {
    if (!window.confirm(`Usunąć notatkę „${noteDisplayTitle({ title, content: note.content })}”?`)) return
    discardRef.current = false
    try {
      await deleteNote(note.id)
      toast.success("Usunięto notatkę")
      onDeleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się usunąć")
    }
  }

  const tasks = detail?.tasks ?? []
  const togglePin = () => updateNote(note.id, { isPinned: !note.isPinned }).catch(() => toast.error("Nie udało się"))

  const titleInput = (
    <input
      autoFocus={autoFocusTitle}
      value={title}
      onChange={(e) => {
        setTitle(e.target.value)
        pendingTitle.current = e.target.value
        if (titleTimer.current) clearTimeout(titleTimer.current)
        titleTimer.current = setTimeout(saveTitle, TITLE_SAVE_DELAY)
      }}
      onBlur={saveTitle}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          if (!editor) return
          // Right away - the editor's own focus waits a frame, and fast typing would stay in the title
          editor.view.dom.focus()
          editor.commands.focus("start")
        }
      }}
      enterKeyHint="next"
      placeholder="Tytuł"
      className={cn(
        "w-full bg-transparent font-semibold outline-none placeholder:text-muted-foreground/60",
        layout === "screen" ? "text-xl" : "text-2xl"
      )}
    />
  )

  const taskLinks = tasks.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Zadania z tej notatki:</span>
      {tasks.map((task) => {
        const day = task.scheduledDate?.slice(0, 10)
        const done = task.status === "COMPLETED"
        return (
          <Link
            key={task.id}
            href={day ? `/schedule?date=${day}&task=${task.id}` : "/schedule"}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted",
              done && "text-muted-foreground line-through"
            )}
          >
            {done ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Circle className="h-3 w-3" />}
            {task.title}
            {day && <span className="text-muted-foreground">· {formatDayShort(day)}</span>}
          </Link>
        )
      })}
    </div>
  )

  if (layout === "screen") {
    const status = combinedStatus(titleStatus, contentStatus)
    return (
      <div className="flex h-full flex-col bg-background">
        {/* Top bar: back, what happened with the text, menu */}
        <div className="flex h-14 shrink-0 items-center gap-1 border-b px-1">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onBack} aria-label="Wróć do listy">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
            {note.pending ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                <CloudOff className="h-3.5 w-3.5" />
                Na telefonie - wyśle się z internetem
              </span>
            ) : status === "saving" ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Zapisywanie…
              </span>
            ) : status === "error" ? (
              <span className="inline-flex items-center gap-1 text-destructive">
                <TriangleAlert className="h-3.5 w-3.5" />
                Nie zapisano - spróbuję ponownie
              </span>
            ) : status === "saved" ? (
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-green-600" />
                Zapisano
              </span>
            ) : (
              <>edytowano {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: pl })}</>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={togglePin}
            aria-label={note.isPinned ? "Odepnij" : "Przypnij na górze listy"}
          >
            {note.isPinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Więcej">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="py-2.5" onSelect={() => setTimeout(handleCreateTask, 0)}>
                <ListPlus className="mr-2 h-4 w-4" />
                Utwórz zadanie z notatki
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2.5" onSelect={togglePin}>
                {note.isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                {note.isPinned ? "Odepnij" : "Przypnij na górze listy"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="py-2.5 text-destructive focus:text-destructive"
                onSelect={() => setTimeout(handleDelete, 0)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Usuń notatkę
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title and text - a tap on the empty space below the text continues writing */}
        <div
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-10 pt-3"
          onClick={(e) => {
            if (e.target === e.currentTarget && editor && !editor.isFocused) editor.commands.focus("end")
          }}
        >
          {titleInput}
          {taskLinks}
          <AutosaveRichText
            value={note.content}
            onSave={saveContent}
            placeholder="Pisz… (- lista, [ ] checkbox)"
            title={title || "Notatka"}
            subtitle="Notatka"
            variant="page"
            onStatusChange={setContentStatus}
            contentClassName="min-h-[40vh] max-h-none overflow-visible px-0 py-1 text-base"
            onEditorReady={setEditor}
            taskSource={taskSource}
          />
        </div>

        {/* Formatting - stays right above the keyboard */}
        <div className="shrink-0 border-t bg-background px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <EditorToolbar
            editor={editor}
            variant="mobile"
            onCreateTask={() => {
              if (note.pending) return void toast.info("Zadanie zrobisz z tej notatki, gdy się wyśle - potrzebny internet")
              taskFromText.start?.()
            }}
          />
        </div>
        {taskFromText.dialog}
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Lista
        </Button>
        <span className="text-xs text-muted-foreground">
          edytowano {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: pl })}
        </span>
        {note.pending && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            title="Zapisana na tym urządzeniu - wyśle się sama, gdy będzie internet"
          >
            <CloudOff className="h-3 w-3" />
            czeka na wysłanie
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCreateTask}
            title="Zaznacz fragment notatki, żeby zrobić zadanie tylko z niego"
          >
            <ListPlus className="mr-1.5 h-4 w-4" />
            Utwórz zadanie
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            title={note.isPinned ? "Odepnij" : "Przypnij na górze listy"}
            onClick={togglePin}
          >
            {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" title="Usuń" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {titleInput}
      {taskLinks}

      <AutosaveRichText
        value={note.content}
        onSave={saveContent}
        placeholder="Pisz… (# nagłówek, - lista, [ ] checkbox)"
        title={title || "Notatka"}
        subtitle="Notatka"
        className="flex-1"
        contentClassName="min-h-[45vh] max-h-none text-[15px]"
        onEditorReady={setEditor}
        taskSource={taskSource}
      />
      <p className="text-xs text-muted-foreground">
        Zaznacz fragment albo kliknij w linijkę i wybierz „Zadanie” - powstanie zadanie w harmonogramie, a tekst dostanie
        kółko, które odhaczy się, gdy zadanie zrobisz.
      </p>
      {taskFromText.dialog}
    </div>
  )
}
