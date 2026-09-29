"use client"

import { useEffect, useState } from "react"
import { EditorContent, type Editor } from "@tiptap/react"
import { cn } from "@/lib/utils"
import { EditorToolbar } from "./editor-toolbar"
import { DocumentEditorDialog, SaveStatusLabel, type SaveStatus } from "./document-editor-dialog"
import { useRichTextEditor } from "./rich-text-editor"

interface DescriptionFieldProps {
  value: string | null | undefined
  onChange: (html: string) => void
  onBlur?: () => void
  // Called when the full screen document is closed
  onDocumentClose?: () => void
  placeholder?: string
  // Shown in the full screen header, e.g. the task title
  title?: string
  subtitle?: string
  status?: SaveStatus
  className?: string
  contentClassName?: string
  // Access to the editor, e.g. to read the selected text
  onEditorReady?: (editor: Editor | null) => void
}

// Description box with formatting that can be opened as a full screen document
export function DescriptionField({
  value,
  onChange,
  onBlur,
  onDocumentClose,
  placeholder = "Dodaj opis…",
  title,
  subtitle,
  status,
  className,
  contentClassName,
  onEditorReady,
}: DescriptionFieldProps) {
  const [isDocumentOpen, setIsDocumentOpen] = useState(false)
  // While the full screen page is open the small editor keeps its content and catches up on close
  const [valueAtOpen, setValueAtOpen] = useState<string | null | undefined>(null)
  const editor = useRichTextEditor({
    value: isDocumentOpen ? valueAtOpen : value,
    onChange,
    onBlur,
    placeholder,
    contentClassName: cn("min-h-[88px] max-h-[360px] overflow-y-auto px-3 py-2 text-sm", contentClassName),
  })

  useEffect(() => {
    onEditorReady?.(editor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return (
    <div className={cn("space-y-1", className)}>
      <div className="rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/30">
        <div className="border-b px-1.5 py-1">
          <EditorToolbar
            editor={editor}
            variant="compact"
            onExpand={() => {
              setValueAtOpen(value)
              setIsDocumentOpen(true)
            }}
          />
        </div>
        <div onClick={() => editor && !editor.isFocused && editor.commands.focus()} className="cursor-text">
          <EditorContent editor={editor} />
        </div>
      </div>
      {status && status !== "idle" && (
        <div className="flex justify-end">
          <SaveStatusLabel status={status} />
        </div>
      )}

      <DocumentEditorDialog
        open={isDocumentOpen}
        onOpenChange={(open) => {
          setIsDocumentOpen(open)
          if (!open) onDocumentClose?.()
        }}
        title={title}
        subtitle={subtitle}
        value={value}
        onChange={onChange}
        status={status}
      />
    </div>
  )
}
