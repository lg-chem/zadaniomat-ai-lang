"use client"

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import useSWR from "swr"
import type { Editor } from "@tiptap/react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { toast } from "sonner"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  CloudOff,
  Copy,
  History,
  ListPlus,
  Loader2,
  Lock,
  MoreVertical,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DescriptionField, RichTextView } from "@/components/editor/lazy"
import {
  CreateTaskFromTextDialog,
  textToHtml,
  useTaskFromText,
  type TaskFromTextDraft,
} from "@/components/tasks/create-task-from-text-dialog"
import type { NoteTask, TaskTextSource } from "@/hooks/use-notes"
import { useIsCompactScreen } from "@/hooks/use-media-query"
import { escapeHtml } from "@/lib/rich-text"
import { formatDayShort } from "@/lib/task-recurrence"
import { newNoteId } from "@/lib/note-outbox"
import { cn } from "@/lib/utils"
import { clearEntryBackup, type EntryBackup } from "./draft-backup"
import { draftHasText, useEntryAutosave } from "./use-entry-autosave"
import {
  ENTRY_TYPE_CONFIG,
  ENTRY_TYPES,
  EntryTypeIcon,
  draftFromEntry,
  entryDisplayTitle,
  type EntryDraft,
  type KnowledgeEntry,
  type KnowledgeStep,
} from "./types"

export interface CategoryOption {
  id: string
  name: string
  color: string
}

interface KnowledgeEntryEditorProps {
  // null - a new entry, created with the first text
  entry: KnowledgeEntry | null
  // Starting values of a new entry (chosen category, copy of a template)
  preset?: Partial<EntryDraft>
  // Text kept on this device after a failed save
  restore?: EntryBackup
  // Someone else's entry shared with the team - read and make tasks, no editing
  readOnly?: boolean
  categories: CategoryOption[]
  workspace: string
  onSaved: (entry: KnowledgeEntry) => void
  onDeleted: (id: string) => void
  onClose: () => void
  onShowHistory?: (entry: KnowledgeEntry) => void
}

const EMPTY_DRAFT: EntryDraft = {
  title: "",
  content: "",
  categoryId: "",
  type: "ARTICLE",
  visibility: "PRIVATE",
  isImportant: false,
  tags: [],
  steps: [],
}

// Task description for a whole entry: the text, and the steps of a procedure as checkboxes
export function entryTaskDescription(draft: Pick<EntryDraft, "content" | "steps">): string | null {
  const steps = draft.steps.filter((step) => step.title.trim())
  const checklist = steps.length
    ? `<ul data-type="taskList">${steps
        .map((step) => `<li data-type="taskItem" data-checked="false"><p>${escapeHtml(step.title.trim())}</p></li>`)
        .join("")}</ul>`
    : ""
  const html = `${draft.content || ""}${checklist}`
  return html.trim() ? html : null
}

// One knowledge entry on its own page: written like a note (saved automatically),
// with category, type, tags and tasks made from it
export function KnowledgeEntryEditor({
  entry,
  preset,
  restore,
  readOnly = false,
  categories,
  workspace,
  onSaved,
  onDeleted,
  onClose,
  onShowHistory,
}: KnowledgeEntryEditorProps) {
  const isCompact = useIsCompactScreen()
  const [initial] = useState(() => {
    const base = entry ? draftFromEntry(entry) : { ...EMPTY_DRAFT, ...preset }
    return {
      draft: restore ? { ...base, ...restore.draft } : base,
      clientId: restore?.clientId ?? newNoteId(),
    }
  })
  const [draft, setDraft] = useState<EntryDraft>(initial.draft)
  const [editor, setEditor] = useState<Editor | null>(null)
  const closingRef = useRef(false)

  const autosave = useEntryAutosave({
    entry,
    initialDraft: initial.draft,
    initialDirty: restore ? restore.draft : undefined,
    clientId: initial.clientId,
    workspace,
    onSaved,
  })
  const entryId = autosave.entryId

  const update = useCallback(
    (fields: Partial<EntryDraft>, immediate = false) => {
      setDraft((current) => ({ ...current, ...fields }))
      autosave.change(fields, immediate)
    },
    [autosave]
  )

  const taskSource = useMemo<TaskTextSource | undefined>(
    () => (entryId ? { kind: "knowledge", id: entryId } : undefined),
    [entryId]
  )
  const taskFromText = useTaskFromText(editor, taskSource)
  const [stepTask, setStepTask] = useState<TaskFromTextDraft | null>(null)
  const { data: tasks = [] } = useSWR<NoteTask[]>(entryId ? `/api/knowledge/entries/${entryId}/tasks` : null, {
    revalidateOnFocus: false,
  })

  const needsSaveFirst = () => {
    toast.info("Najpierw wpisz tytuł albo treść - wpis zapisze się sam i wtedy zrobisz z niego zadanie")
  }

  // Selected fragment (linked in the text), otherwise the whole entry
  const createTaskFromEntry = () => {
    if (!taskSource) return needsSaveFirst()
    taskFromText.start?.({
      whole: {
        title: entryDisplayTitle(draft),
        description: entryTaskDescription(draft),
        descriptionLabel: draft.steps.length
          ? "Skopiuj treść i kroki (jako checklistę) do opisu zadania"
          : "Skopiuj treść wpisu do opisu zadania",
      },
    })
  }

  const createTaskFromStep = (step: KnowledgeStep) => {
    if (!taskSource) return needsSaveFirst()
    const details = [step.description?.trim(), step.assignedRole?.trim() && `Odpowiedzialny: ${step.assignedRole.trim()}`]
      .filter(Boolean)
      .join("\n")
    setStepTask({
      source: taskSource,
      title: step.title.trim().slice(0, 200),
      description: details ? textToHtml(details) : null,
      descriptionLabel: "Dodaj opis kroku do zadania",
      range: null,
    })
  }

  const deleteEntry = async (id: string) => {
    const res = await fetch(`/api/knowledge/entries/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Nie udało się usunąć wpisu")
    clearEntryBackup(id)
    onDeleted(id)
  }

  const finish = async () => {
    if (closingRef.current) return
    closingRef.current = true
    try {
      if (readOnly) return onClose()
      const current = autosave.draft()

      if (!draftHasText(current)) {
        const id = autosave.entryId
        autosave.discard()
        if (id && autosave.createdHere()) {
          // Started and emptied again - don't keep an empty entry
          await deleteEntry(id).catch(() => {})
        } else if (id && window.confirm("Wpis jest pusty. Usunąć go z bazy wiedzy?\n\nAnuluj - zostanie poprzednia treść.")) {
          await deleteEntry(id).catch(() => toast.error("Nie udało się usunąć wpisu"))
        }
        clearEntryBackup(id ?? initial.clientId)
        return onClose()
      }

      const saved = await autosave.flush({ reindex: true })
      if (
        !saved &&
        !window.confirm(
          "Nie udało się zapisać ostatnich zmian.\n\nZamknąć mimo to? Tekst zostaje na tym urządzeniu - przywrócisz go nad listą wpisów."
        )
      ) {
        return
      }
      onClose()
    } finally {
      closingRef.current = false
    }
  }

  const handleDelete = async () => {
    const id = autosave.entryId
    if (!id) return
    if (!window.confirm(`Usunąć wpis „${entryDisplayTitle(draft)}”?`)) return
    autosave.discard()
    try {
      await deleteEntry(id)
      toast.success("Wpis usunięty")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się usunąć wpisu")
    }
  }

  const showHistory = async () => {
    const id = autosave.entryId
    if (!id || !onShowHistory) return
    await autosave.flush({ reindex: true })
    onClose()
    onShowHistory({ ...(entry as KnowledgeEntry), id, title: draft.title })
  }

  const statusText = (() => {
    if (readOnly) {
      return (
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          Wpis od {entry?.user?.name || "zespołu"} - tylko do odczytu
        </span>
      )
    }
    if (autosave.status === "saving") {
      return (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Zapisywanie…
        </span>
      )
    }
    if (autosave.status === "error") {
      return (
        <span className="inline-flex items-center gap-1 font-medium text-destructive" title={autosave.error ?? undefined}>
          {autosave.error?.startsWith("Brak połączenia") ? <CloudOff className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
          {autosave.error || "Nie zapisano"} - tekst jest bezpieczny na tym urządzeniu
        </span>
      )
    }
    if (autosave.status === "saved") {
      return (
        <span className="inline-flex items-center gap-1">
          <Check className="h-3.5 w-3.5 text-green-600" />
          Zapisano
        </span>
      )
    }
    if (!entryId) return <>Nowy wpis - zapisze się sam, gdy zaczniesz pisać</>
    return <>Zmiany zapisują się same</>
  })()

  const taskLinks = tasks.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Zadania z tego wpisu:</span>
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

  const category = categories.find((c) => c.id === draft.categoryId)
  const typeConfig = ENTRY_TYPE_CONFIG[draft.type]

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && void finish()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 md:inset-x-auto md:bottom-4 md:left-1/2 md:top-4 md:w-[min(60rem,calc(100vw-2rem))] md:-translate-x-1/2 md:overflow-hidden md:rounded-xl md:border md:shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            {entryId ? entryDisplayTitle(draft) : "Nowy wpis w bazie wiedzy"}
          </DialogPrimitive.Title>

          {/* Top bar: close, what happened with the text, actions */}
          <div className="flex h-14 shrink-0 items-center gap-1 border-b px-1.5 md:px-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => void finish()}
              aria-label="Zamknij"
              title="Zamknij"
            >
              {isCompact ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </Button>
            <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
              {statusText}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={createTaskFromEntry}
              title="Zrób zadanie z całego wpisu - albo zaznacz fragment, żeby zrobić je tylko z niego"
            >
              <ListPlus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Utwórz zadanie</span>
            </Button>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => update({ isImportant: !draft.isImportant }, true)}
                title={draft.isImportant ? "Usuń z ważnych" : "Oznacz jako ważne"}
                aria-pressed={draft.isImportant}
              >
                <Star className={cn("h-4 w-4", draft.isImportant && "fill-yellow-500 text-yellow-500")} />
              </Button>
            )}
            {!readOnly && entryId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Więcej">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {onShowHistory && entry && (
                    <DropdownMenuItem onSelect={() => setTimeout(() => void showHistory(), 0)}>
                      <History className="mr-2 h-4 w-4" />
                      Historia wersji
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={() => {
                      void navigator.clipboard.writeText(`${draft.title}\n\n${editor?.getText() ?? ""}`.trim())
                      toast.success("Skopiowano treść")
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Kopiuj jako tekst
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setTimeout(() => void handleDelete(), 0)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Usuń wpis
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button size="sm" className="ml-1 h-9 shrink-0" onClick={() => void finish()}>
              <Check className="mr-1 h-4 w-4" />
              Gotowe
            </Button>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            onClick={(e) => {
              // A click on the empty space below the text continues writing
              if (e.target === e.currentTarget && editor && !editor.isFocused) editor.commands.focus("end")
            }}
          >
            <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-4 md:px-8 md:pt-6">
              {readOnly ? (
                <div className="flex flex-wrap items-center gap-2">
                  {category && (
                    <Badge variant="outline" style={{ borderColor: category.color, color: category.color }}>
                      {category.name}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="gap-1">
                    <EntryTypeIcon type={draft.type} className="h-3 w-3" />
                    {typeConfig.label}
                  </Badge>
                  {draft.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={draft.categoryId} onValueChange={(categoryId) => update({ categoryId }, true)}>
                    <SelectTrigger className="h-8 w-auto max-w-[260px] gap-2 text-sm" aria-label="Kategoria">
                      <SelectValue placeholder="Kategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={draft.type} onValueChange={(type) => update({ type: type as EntryDraft["type"] }, true)}>
                    <SelectTrigger className="h-8 w-auto gap-2 text-sm" aria-label="Typ wpisu">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTRY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          <span className="flex items-center gap-2">
                            <EntryTypeIcon type={type} className="h-3.5 w-3.5 text-muted-foreground" />
                            {ENTRY_TYPE_CONFIG[type].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 font-normal"
                    onClick={() => update({ visibility: draft.visibility === "TEAM" ? "PRIVATE" : "TEAM" }, true)}
                    title={
                      draft.visibility === "TEAM"
                        ? "Widzą go członkowie zespołu z tą samą kategorią - kliknij, żeby był tylko Twój"
                        : "Widzisz go tylko Ty - kliknij, żeby udostępnić zespołowi"
                    }
                  >
                    {draft.visibility === "TEAM" ? <Users className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {draft.visibility === "TEAM" ? "Zespół" : "Tylko ja"}
                  </Button>

                  <TagsInput tags={draft.tags} onChange={(tags) => update({ tags }, true)} />
                </div>
              )}

              {readOnly ? (
                <h1 className="text-2xl font-semibold md:text-3xl">{entryDisplayTitle(draft)}</h1>
              ) : (
                <input
                  autoFocus={!entry && !preset?.title}
                  value={draft.title}
                  onChange={(e) => update({ title: e.target.value })}
                  onBlur={() => void autosave.flush()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (!editor) return
                      editor.view.dom.focus()
                      editor.commands.focus("start")
                    }
                  }}
                  enterKeyHint="next"
                  placeholder={draft.type === "FAQ" ? "Pytanie" : "Tytuł wpisu"}
                  aria-label="Tytuł"
                  className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/60 md:text-3xl"
                />
              )}

              {taskLinks}

              {readOnly ? (
                <RichTextView value={draft.content} className="text-[15px]" />
              ) : (
                <DescriptionField
                  value={draft.content}
                  onChange={(content) => update({ content })}
                  onBlur={() => void autosave.flush()}
                  onDocumentClose={() => void autosave.flush()}
                  placeholder={
                    draft.type === "FAQ"
                      ? "Odpowiedź…"
                      : draft.type === "CHECKLIST"
                        ? "Wpisz [ ] i spację, żeby zacząć listę do odhaczenia…"
                        : "Pisz… (# nagłówek, - lista, 1. numeracja, Tab - podpunkt)"
                  }
                  title={draft.title || "Wpis"}
                  subtitle="Baza wiedzy"
                  contentClassName="min-h-[40vh] max-h-none text-[15px]"
                  onEditorReady={setEditor}
                  taskSource={taskSource}
                />
              )}

              {(draft.type === "SOP" || draft.steps.length > 0) &&
                (readOnly ? (
                  <StepsView steps={draft.steps} onCreateTask={createTaskFromStep} />
                ) : (
                  <StepsEditor
                    steps={draft.steps}
                    onChange={(steps) => update({ steps })}
                    onCreateTask={createTaskFromStep}
                  />
                ))}

              {!readOnly && (
                <p className="text-xs text-muted-foreground">
                  Zaznacz fragment albo kliknij w linijkę i wybierz „Zadanie” - powstanie zadanie w harmonogramie, a tekst
                  dostanie kółko, które odhaczy się, gdy zadanie zrobisz. „Utwórz zadanie” na górze robi zadanie z całego
                  wpisu.
                </p>
              )}
            </div>
          </div>

          {taskFromText.dialog}
          <CreateTaskFromTextDialog draft={stepTask} onClose={() => setStepTask(null)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState("")

  const add = () => {
    const tag = value.trim().replace(/^#/, "").replace(/,$/, "").trim()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setValue("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      add()
    } else if (e.key === "Backspace" && !value && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border px-1.5 py-0.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-0.5 pr-1 text-xs font-normal">
          #{tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="rounded-sm hover:text-destructive"
            aria-label={`Usuń tag ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={tags.length ? "+ tag" : "Tagi (Enter)"}
        aria-label="Dodaj tag"
        className="h-6 w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

function stepsSummary(steps: KnowledgeStep[]) {
  const minutes = steps.reduce((sum, step) => sum + (step.estimatedTime || 0), 0)
  return minutes ? `${steps.length} · ok. ${minutes} min` : `${steps.length}`
}

function StepsEditor({
  steps,
  onChange,
  onCreateTask,
}: {
  steps: KnowledgeStep[]
  onChange: (steps: KnowledgeStep[]) => void
  onCreateTask: (step: KnowledgeStep) => void
}) {
  const patch = (index: number, fields: Partial<KnowledgeStep>) =>
    onChange(steps.map((step, i) => (i === index ? { ...step, ...fields } : step)))

  return (
    <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Kroki procedury</h3>
        {steps.length > 0 && <span className="text-xs text-muted-foreground">{stepsSummary(steps)}</span>}
      </div>
      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-2 rounded-lg border bg-background p-2.5">
          <span className="mt-2 w-5 shrink-0 text-right text-sm font-bold text-primary">{index + 1}.</span>
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              value={step.title}
              onChange={(e) => patch(index, { title: e.target.value })}
              placeholder="Co trzeba zrobić"
              className="h-9 font-medium"
              aria-label={`Krok ${index + 1}`}
            />
            <Textarea
              value={step.description || ""}
              onChange={(e) => patch(index, { description: e.target.value })}
              placeholder="Szczegóły, linki, uwagi (opcjonalnie)"
              rows={2}
              className="min-h-[60px] text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  value={step.estimatedTime || ""}
                  onChange={(e) => patch(index, { estimatedTime: parseInt(e.target.value) || null })}
                  placeholder="min"
                  className="h-8 w-20"
                  aria-label="Czas w minutach"
                />
              </span>
              <Input
                value={step.assignedRole || ""}
                onChange={(e) => patch(index, { assignedRole: e.target.value })}
                placeholder="Kto (np. HR)"
                className="h-8 w-40"
                aria-label="Odpowiedzialny"
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!step.title.trim()}
              onClick={() => onCreateTask(step)}
              title="Zrób zadanie z tego kroku"
            >
              <ListPlus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onChange(steps.filter((_, i) => i !== index))}
              title="Usuń krok"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...steps, { order: steps.length, title: "", description: null, estimatedTime: null, assignedRole: null }])
        }
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Dodaj krok
      </Button>
    </section>
  )
}

function StepsView({ steps, onCreateTask }: { steps: KnowledgeStep[]; onCreateTask: (step: KnowledgeStep) => void }) {
  if (steps.length === 0) return null
  return (
    <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Kroki procedury</h3>
        <span className="text-xs text-muted-foreground">{stepsSummary(steps)}</span>
      </div>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step.id || index} className="flex items-start gap-2 rounded-lg border bg-background p-2.5">
            <span className="w-5 shrink-0 text-right text-sm font-bold text-primary">{index + 1}.</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{step.title}</span>
                {step.estimatedTime ? <span className="text-xs text-muted-foreground">~{step.estimatedTime} min</span> : null}
                {step.assignedRole && (
                  <Badge variant="outline" className="text-xs">
                    {step.assignedRole}
                  </Badge>
                )}
              </div>
              {step.description && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{step.description}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {step.description && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    void navigator.clipboard.writeText(step.description || "")
                    toast.success("Skopiowano do schowka")
                  }}
                  title="Kopiuj instrukcję"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onCreateTask(step)}
                title="Zrób zadanie z tego kroku"
              >
                <ListPlus className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
