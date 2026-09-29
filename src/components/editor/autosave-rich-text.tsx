"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Editor } from "@tiptap/react"
import { DescriptionField } from "@/components/editor/lazy"
import type { SaveStatus } from "@/components/editor/document-editor-dialog"
import { normalizeRichText } from "@/lib/rich-text"

interface AutosaveRichTextProps {
  // Saved value (from the server)
  value: string | null | undefined
  // Stores the text; throw to show the error and retry on the next change
  onSave: (html: string | null) => Promise<void>
  onSaved?: () => void
  placeholder?: string
  title?: string
  subtitle?: string
  className?: string
  contentClassName?: string
  onEditorReady?: (editor: Editor | null) => void
}

const AUTOSAVE_DELAY = 1000

// Formatted text saved automatically: 1 s after typing, when leaving the field
// and when the full screen page is closed
export function AutosaveRichText({
  value: savedValue,
  onSave,
  onSaved,
  placeholder,
  title,
  subtitle,
  className,
  contentClassName,
  onEditorReady,
}: AutosaveRichTextProps) {
  const [value, setValue] = useState(savedValue || "")
  const [status, setStatus] = useState<SaveStatus>("idle")
  const savedValueRef = useRef<string | null>(normalizeRichText(savedValue))
  const pendingValueRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  const onSavedRef = useRef(onSaved)
  onSaveRef.current = onSave
  onSavedRef.current = onSaved

  // Take changes from outside (e.g. the full edit dialog), but not the echo of our own save
  useEffect(() => {
    const incoming = normalizeRichText(savedValue)
    if (pendingValueRef.current !== null || incoming === savedValueRef.current) return
    savedValueRef.current = incoming
    setValue(savedValue || "")
  }, [savedValue])

  const save = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const next = pendingValueRef.current
    if (next === null) return
    pendingValueRef.current = null
    const normalized = normalizeRichText(next)
    if (normalized === savedValueRef.current) return

    setStatus("saving")
    try {
      await onSaveRef.current(normalized)
      savedValueRef.current = normalized
      setStatus("saved")
      onSavedRef.current?.()
    } catch (error) {
      console.error("Error saving text:", error)
      // Keep the text so the next change or blur retries
      if (pendingValueRef.current === null) pendingValueRef.current = next
      setStatus("error")
    }
  }, [])

  const handleChange = (html: string) => {
    setValue(html)
    pendingValueRef.current = html
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, AUTOSAVE_DELAY)
  }

  // Don't lose the last keystrokes when the field goes away
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (pendingValueRef.current !== null) void save()
    }
  }, [save])

  return (
    <DescriptionField
      value={value}
      onChange={handleChange}
      onBlur={save}
      onDocumentClose={save}
      placeholder={placeholder}
      title={title}
      subtitle={subtitle}
      status={status}
      className={className}
      contentClassName={contentClassName}
      onEditorReady={onEditorReady}
    />
  )
}
