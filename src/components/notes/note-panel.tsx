"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { Editor } from "@tiptap/react"
import { formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, Circle, ListPlus, Pin, PinOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AutosaveRichText } from "@/components/editor/autosave-rich-text"
import { useNoteActions, useNoteDetail, type Note } from "@/hooks/use-notes"
import { htmlToPlainText } from "@/lib/rich-text"
import { formatDayShort } from "@/lib/task-recurrence"
import { cn } from "@/lib/utils"
import type { TaskFromNoteDraft } from "./create-task-from-note-dialog"
import { textToHtml } from "./create-task-from-note-dialog"

interface NotePanelProps {
  note: Note
  onBack: () => void
  onDeleted: () => void
  onCreateTask: (draft: TaskFromNoteDraft) => void
  autoFocusTitle?: boolean
}

const TITLE_SAVE_DELAY = 800

export function noteDisplayTitle(note: Pick<Note, "title" | "content">): string {
  if (note.title.trim()) return note.title
  const firstLine = htmlToPlainText(note.content).split("\n").find((line) => line.trim())
  return firstLine?.replace(/^[•☐☑]\s*/, "").slice(0, 120) || "Bez tytułu"
}

// One note: title, text with formatting (saved automatically), tasks made from it
export function NotePanel({ note, onBack, onDeleted, onCreateTask, autoFocusTitle }: NotePanelProps) {
  const { updateNote, deleteNote } = useNoteActions()
  const { note: detail } = useNoteDetail(note.id)
  const [title, setTitle] = useState(note.title)
  const editorRef = useRef<Editor | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTitle = useRef<string | null>(null)

  const saveTitle = useCallback(async () => {
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = null
    const next = pendingTitle.current
    pendingTitle.current = null
    if (next === null) return
    try {
      await updateNote(note.id, { title: next })
    } catch {
      toast.error("Nie udało się zapisać tytułu")
    }
  }, [note.id, updateNote])

  // Save a title typed just before switching to another note
  useEffect(() => () => void saveTitle(), [saveTitle])

  const saveContent = useCallback(
    async (content: string | null) => {
      await updateNote(note.id, { content })
    },
    [note.id, updateNote]
  )

  const handleCreateTask = () => {
    const editor = editorRef.current
    let selected = ""
    if (editor && !editor.state.selection.empty) {
      const { from, to } = editor.state.selection
      selected = editor.state.doc.textBetween(from, to, "\n").trim()
    }

    if (selected) {
      const [first, ...rest] = selected.split("\n").map((line) => line.trim()).filter(Boolean)
      onCreateTask({
        noteId: note.id,
        title: first.slice(0, 200),
        description: rest.length ? textToHtml(rest.join("\n")) : null,
        descriptionLabel: "Dodaj pozostałe zaznaczone linie do opisu",
      })
      return
    }

    onCreateTask({
      noteId: note.id,
      title: noteDisplayTitle({ title, content: note.content }).slice(0, 200),
      description: note.content,
      descriptionLabel: "Skopiuj treść notatki do opisu zadania",
    })
  }

  const handleDelete = async () => {
    if (!window.confirm(`Usunąć notatkę „${noteDisplayTitle({ title, content: note.content })}”?`)) return
    try {
      await deleteNote(note.id)
      toast.success("Usunięto notatkę")
      onDeleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się usunąć")
    }
  }

  const tasks = detail?.tasks ?? []

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
            onClick={() => updateNote(note.id, { isPinned: !note.isPinned }).catch(() => toast.error("Nie udało się"))}
          >
            {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" title="Usuń" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
            editorRef.current?.commands.focus("start")
          }
        }}
        placeholder="Tytuł"
        className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/60"
      />

      {tasks.length > 0 && (
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
      )}

      <AutosaveRichText
        value={note.content}
        onSave={saveContent}
        placeholder="Pisz… (# nagłówek, - lista, [ ] checkbox)"
        title={title || "Notatka"}
        subtitle="Notatka"
        className="flex-1"
        contentClassName="min-h-[45vh] max-h-none text-[15px]"
        onEditorReady={(editor) => {
          editorRef.current = editor
        }}
      />
      <p className="text-xs text-muted-foreground">
        Zaznacz linijkę lub fragment i kliknij „Utwórz zadanie”, żeby zrobić z niego zadanie w harmonogramie.
      </p>
    </div>
  )
}
