"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { DescriptionField } from "@/components/editor/lazy"
import type { SaveStatus } from "@/components/editor/document-editor-dialog"
import { normalizeRichText } from "@/lib/rich-text"

interface EditableDescriptionProps {
  taskId: string
  initialValue: string | null | undefined
  onSaved?: () => void
  placeholder?: string
  // Task title, shown in the full screen document header
  title?: string
}

const AUTOSAVE_DELAY = 1000

// Task description with formatting, saved automatically while typing
export function EditableDescription({
  taskId,
  initialValue,
  onSaved,
  placeholder = "Dodaj opis...",
  title,
}: EditableDescriptionProps) {
  const [value, setValue] = useState(initialValue || "")
  const [status, setStatus] = useState<SaveStatus>("idle")
  const savedValueRef = useRef<string | null>(normalizeRichText(initialValue))
  const pendingValueRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  // Take changes from outside (e.g. the full edit dialog), but not the echo of our own save
  useEffect(() => {
    const incoming = normalizeRichText(initialValue)
    if (pendingValueRef.current !== null || incoming === savedValueRef.current) return
    savedValueRef.current = incoming
    setValue(initialValue || "")
  }, [initialValue])

  const save = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const next = pendingValueRef.current
    if (next === null) return
    pendingValueRef.current = null
    const description = normalizeRichText(next)
    if (description === savedValueRef.current) return

    setStatus("saving")
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      savedValueRef.current = description
      setStatus("saved")
      onSavedRef.current?.()
    } catch (error) {
      console.error("Error saving description:", error)
      // Keep the text so the next change or blur retries
      if (pendingValueRef.current === null) pendingValueRef.current = next
      setStatus("error")
    }
  }, [taskId])

  const handleChange = (html: string) => {
    setValue(html)
    pendingValueRef.current = html
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, AUTOSAVE_DELAY)
  }

  // Don't lose the last keystrokes when the row is collapsed
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
      subtitle="Opis zadania"
      status={status}
    />
  )
}
