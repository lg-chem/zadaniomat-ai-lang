"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Editor } from "@tiptap/react"
import { format } from "date-fns"
import { toast } from "sonner"
import { CheckSquare, Clock, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useNoteActions, type NoteTask, type TaskTextSource } from "@/hooks/use-notes"
import { useCategories } from "@/hooks/use-categories"
import { addTaskRef, textForTask, type TaskRefRange } from "@/components/editor/task-ref-text"
import { escapeHtml } from "@/lib/rich-text"

export interface TaskFromTextDraft {
  source: TaskTextSource
  title: string
  // Text that can go into the task description (rest of the selection or the whole note)
  description: string | null
  descriptionLabel: string
  // Text in the editor that gets a link to the new task
  range: TaskRefRange | null
}

interface CreateTaskFromTextDialogProps {
  draft: TaskFromTextDraft | null
  onClose: () => void
  onCreated?: (task: NoteTask, draft: TaskFromTextDraft) => void
}

// Plain text of a selection → paragraphs for the task description
export function textToHtml(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")
}

export function CreateTaskFromTextDialog({ draft, onClose, onCreated }: CreateTaskFromTextDialogProps) {
  const router = useRouter()
  const { createTaskFromText } = useNoteActions()
  const { categories } = useCategories()
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [minutes, setMinutes] = useState("25")
  const [categoryId, setCategoryId] = useState("")
  const [withDescription, setWithDescription] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!draft) return
    setTitle(draft.title)
    setDate(format(new Date(), "yyyy-MM-dd"))
    setTime("")
    setMinutes("25")
    setCategoryId("")
    setWithDescription(!!draft.description)
  }, [draft])

  const submit = async () => {
    if (!draft || !title.trim()) return
    setIsSaving(true)
    try {
      const task = await createTaskFromText(draft.source, {
        title: title.trim(),
        description: withDescription ? draft.description : null,
        scheduledDate: date || null,
        scheduledTime: time || null,
        plannedMinutes: parseInt(minutes) || 25,
        categoryId: categoryId || null,
      })
      onCreated?.(task, draft)
      const day = date || format(new Date(), "yyyy-MM-dd")
      toast.success(`Dodano zadanie „${task.title}”`, {
        action: {
          label: "Otwórz",
          onClick: () => router.push(`/schedule?date=${day}&task=${task.id}`),
        },
      })
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się utworzyć zadania")
    } finally {
      setIsSaving(false)
    }
  }

  const fromNote = draft?.source.kind !== "task"

  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            {fromNote ? "Zadanie z notatki" : "Zadanie z opisu"}
          </DialogTitle>
          <DialogDescription>
            {draft?.range
              ? "Trafi do harmonogramu wybranego dnia. Tekst dostanie odnośnik do zadania i odhaczy się, gdy je zrobisz."
              : "Trafi do harmonogramu wybranego dnia. Notatka zostaje bez zmian."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="text-task-title">Tytuł zadania</Label>
            <Input id="text-task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-auto" aria-label="Data" />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-[110px]" aria-label="Godzina (opcjonalnie)" />
            <div className="flex items-center gap-1.5 text-sm">
              <Input
                type="number"
                min={5}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="h-9 w-20"
                aria-label="Planowany czas w minutach"
              />
              <span className="text-muted-foreground">min</span>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 w-full max-w-[260px]">
                  <SelectValue />
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
            </div>
          )}

          {draft?.description && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={withDescription} onCheckedChange={(v) => setWithDescription(v === true)} />
              {draft.descriptionLabel}
            </label>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving || !title.trim()}>
              {isSaving ? "Dodawanie…" : "Dodaj zadanie"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface StartOptions {
  // Without a selection: the whole text instead of the line with the cursor
  whole?: { title: string; description: string | null }
}

// "Make a task" for an editor: from the selection or the line with the cursor.
// The text gets a link to the new task. Render `dialog` next to the editor.
export function useTaskFromText(editor: Editor | null, source: TaskTextSource | undefined) {
  const [draft, setDraft] = useState<TaskFromTextDraft | null>(null)
  const sourceKind = source?.kind
  const sourceId = source?.id

  const start = useCallback(
    ({ whole }: StartOptions = {}) => {
      if (!sourceKind || !sourceId) return
      const taskSource: TaskTextSource = { kind: sourceKind, id: sourceId }
      const range = editor && !editor.isDestroyed ? textForTask(editor.state, { line: !whole }) : null

      if (range) {
        const [first, ...rest] = range.text.split("\n").map((line) => line.trim()).filter(Boolean)
        setDraft({
          source: taskSource,
          title: first.slice(0, 200),
          description: rest.length ? textToHtml(rest.join("\n")) : null,
          descriptionLabel: "Dodaj pozostałe zaznaczone linie do opisu",
          range,
        })
        return
      }

      if (whole) {
        setDraft({
          source: taskSource,
          title: whole.title.slice(0, 200),
          description: whole.description,
          descriptionLabel: "Skopiuj treść notatki do opisu zadania",
          range: null,
        })
        return
      }

      toast.info("Zaznacz tekst albo kliknij w linijkę, z której ma powstać zadanie")
    },
    [editor, sourceKind, sourceId]
  )

  const handleCreated = useCallback(
    (task: NoteTask, created: TaskFromTextDraft) => {
      if (!created.range || !editor) return
      if (!addTaskRef(editor, created.range, task.id)) {
        toast.info("Zadanie dodane, ale tekst w międzyczasie się zmienił - odnośnik nie został wstawiony")
      }
    },
    [editor]
  )

  const dialog = source ? (
    <CreateTaskFromTextDialog draft={draft} onClose={() => setDraft(null)} onCreated={handleCreated} />
  ) : null

  return { start: source ? start : undefined, dialog, isOpen: !!draft }
}
