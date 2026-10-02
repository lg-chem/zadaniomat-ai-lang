"use client"

import { useEffect, useRef } from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import { createEditorExtensions } from "./extensions"
import { TaskRefsLayer } from "./task-refs-layer"
import { toEditorHtml } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

interface UseRichTextEditorOptions {
  value: string | null | undefined
  onChange?: (html: string) => void
  onBlur?: () => void
  placeholder?: string
  editable?: boolean
  autofocus?: boolean | "start" | "end"
  contentClassName?: string
}

// Editor bound to a value from outside. Changes typed here go out through onChange;
// a different value coming in (e.g. edited in the full screen view) replaces the content.
export function useRichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  editable = true,
  autofocus = false,
  contentClassName,
}: UseRichTextEditorOptions): Editor | null {
  const initialHtml = toEditorHtml(value)
  const lastHtmlRef = useRef(initialHtml)
  const onChangeRef = useRef(onChange)
  const onBlurRef = useRef(onBlur)
  onChangeRef.current = onChange
  onBlurRef.current = onBlur

  const editor = useEditor({
    extensions: createEditorExtensions({ placeholder, editable }),
    content: initialHtml,
    editable,
    autofocus,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: cn("rich-text focus:outline-none", contentClassName),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML()
      lastHtmlRef.current = html
      onChangeRef.current?.(html)
    },
    onBlur: () => onBlurRef.current?.(),
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const incoming = toEditorHtml(value)
    if (incoming === lastHtmlRef.current) return
    lastHtmlRef.current = incoming
    editor.commands.setContent(incoming, { emitUpdate: false })
  }, [value, editor])

  return editor
}

interface RichTextViewProps {
  value: string | null | undefined
  className?: string
}

// Read-only rendering of a description. Goes through the editor schema,
// so only known formatting is shown (no raw HTML from other users).
export function RichTextView({ value, className }: RichTextViewProps) {
  const editor = useRichTextEditor({ value, editable: false, contentClassName: className })
  if (!editor) {
    return <div className={cn("rich-text whitespace-pre-wrap text-muted-foreground", className)} />
  }
  return (
    <>
      <EditorContent editor={editor} />
      <TaskRefsLayer editor={editor} />
    </>
  )
}
