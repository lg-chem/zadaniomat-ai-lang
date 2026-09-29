"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { useNoteActions } from "@/hooks/use-notes"
import { escapeHtml } from "@/lib/rich-text"

export interface TaskFromNoteDraft {
  noteId: string
  title: string
  // Text that can go into the task description (selected fragment or the whole note)
  description: string | null
  descriptionLabel: string
}

interface CreateTaskFromNoteDialogProps {
  draft: TaskFromNoteDraft | null
  onClose: () => void
  categories: { id: string; name: string; color: string }[]
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

export function CreateTaskFromNoteDialog({ draft, onClose, categories }: CreateTaskFromNoteDialogProps) {
  const router = useRouter()
  const { createTaskFromNote } = useNoteActions()
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
      const task = await createTaskFromNote(draft.noteId, {
        title: title.trim(),
        description: withDescription ? draft.description : null,
        scheduledDate: date || null,
        scheduledTime: time || null,
        plannedMinutes: parseInt(minutes) || 25,
        categoryId: categoryId || null,
      })
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

  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Zadanie z notatki
          </DialogTitle>
          <DialogDescription>Trafi do harmonogramu wybranego dnia. Notatka zostaje bez zmian.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="note-task-title">Tytuł zadania</Label>
            <Input id="note-task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
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
                <SelectTrigger className="h-9 w-[260px]">
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
