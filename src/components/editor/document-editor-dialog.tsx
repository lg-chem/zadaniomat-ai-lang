"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { EditorContent, useEditorState } from "@tiptap/react"
import { AlertCircle, Check, FileText, Loader2, ListTree } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EditorToolbar } from "./editor-toolbar"
import { useRichTextEditor } from "./rich-text-editor"
import { TaskRefsLayer } from "./task-refs-layer"
import { useTaskFromText } from "@/components/tasks/create-task-from-text-dialog"
import type { TaskTextSource } from "@/hooks/use-notes"

export type SaveStatus = "idle" | "saving" | "saved" | "error"

export function SaveStatusLabel({ status, className }: { status?: SaveStatus; className?: string }) {
  if (!status || status === "idle") return null
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Zapisywanie…
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3 text-green-600" />
          Zapisano
        </>
      )}
      {status === "error" && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertCircle className="h-3 w-3" />
          Nie udało się zapisać
        </span>
      )}
    </span>
  )
}

interface DocumentEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  subtitle?: string
  value: string | null | undefined
  onChange: (html: string) => void
  placeholder?: string
  status?: SaveStatus
  taskSource?: TaskTextSource
}

// Full screen "Google Docs" style page for writing longer descriptions and plans
export function DocumentEditorDialog({ open, onOpenChange, ...props }: DocumentEditorDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-muted/70 backdrop-blur-sm outline-none dark:bg-background data-[state=open]:animate-in data-[state=open]:fade-in-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {open && <DocumentEditorBody {...props} onClose={() => onOpenChange(false)} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function DocumentEditorBody({
  title,
  subtitle = "Opis",
  value,
  onChange,
  placeholder = "Zacznij pisać… Wpisz # i spację dla nagłówka, - dla listy, [ ] dla checkboxa",
  status,
  taskSource,
  onClose,
}: Omit<DocumentEditorDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const editor = useRichTextEditor({
    value,
    onChange,
    placeholder,
    autofocus: "end",
    contentClassName: "rich-text-document min-h-[60vh]",
  })
  const taskFromText = useTaskFromText(editor, taskSource)
  const startTask = taskFromText.start
  const createTask = startTask ? () => startTask() : undefined

  // Same as the toolbar: read the editor from the closure, not from the (possibly stale) snapshot
  const info = useEditorState({
    editor,
    selector: () => {
      const e = editor
      if (!e || e.isDestroyed) return { headings: [] as { level: number; text: string; pos: number }[], words: 0 }
      const headings: { level: number; text: string; pos: number }[] = []
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading" && node.textContent.trim()) {
          headings.push({ level: node.attrs.level as number, text: node.textContent, pos })
        }
        return node.type.name !== "heading"
      })
      const words = e.getText().trim().split(/\s+/).filter(Boolean).length
      return { headings, words }
    },
  })

  const goToHeading = (pos: number) => {
    if (!editor) return
    const dom = editor.view.nodeDOM(pos)
    if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: "smooth", block: "start" })
    editor.chain().focus().setTextSelection(pos + 1).run()
  }

  const headings = info?.headings ?? []

  return (
    <>
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 md:px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <DialogPrimitive.Title className="truncate text-base font-medium leading-tight">
            {title || "Dokument"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="flex min-w-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            <span className="truncate">{subtitle}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{info?.words ?? 0} słów</span>
            <SaveStatusLabel status={status} />
          </DialogPrimitive.Description>
        </div>
        <Button size="sm" onClick={onClose}>
          <Check className="mr-1 h-4 w-4" />
          Gotowe
        </Button>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 overflow-x-auto border-b bg-background px-2 py-1 scrollbar-hide">
        <EditorToolbar editor={editor} variant="full" onCreateTask={createTask} className="mx-auto w-max flex-nowrap" />
      </div>

      {/* Page */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1180px] gap-6 px-2 md:px-6">
          <aside className="sticky top-0 hidden h-fit w-56 shrink-0 pt-8 xl:block">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ListTree className="h-3.5 w-3.5" />
              Konspekt
            </div>
            {headings.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Nagłówki, które dodasz do dokumentu, pojawią się tutaj.
              </p>
            ) : (
              <nav className="space-y-0.5">
                {headings.map((heading) => (
                  <button
                    key={heading.pos}
                    type="button"
                    onClick={() => goToHeading(heading.pos)}
                    className={cn(
                      "block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-background",
                      heading.level === 1 && "font-medium",
                      heading.level === 2 && "pl-4",
                      heading.level === 3 && "pl-7 text-muted-foreground"
                    )}
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            )}
          </aside>

          <div className="min-w-0 flex-1 py-4 md:py-8">
            <div
              className="mx-auto min-h-[calc(100vh-10rem)] w-full max-w-[816px] cursor-text rounded-sm border bg-background px-5 py-6 shadow-sm md:px-[72px] md:py-16"
              onClick={(e) => {
                // Clicking the empty part of the page puts the cursor at the end
                if (e.target === e.currentTarget) editor?.chain().focus("end").run()
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
          <TaskRefsLayer editor={editor} onCreateTask={createTask} hideBubble={taskFromText.isOpen} />
          {taskFromText.dialog}

          <div className="hidden w-56 shrink-0 xl:block" aria-hidden />
        </div>
      </div>
    </>
  )
}
