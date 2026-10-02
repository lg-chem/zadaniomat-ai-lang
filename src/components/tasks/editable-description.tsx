"use client"

import { useCallback } from "react"
import { AutosaveRichText } from "@/components/editor/autosave-rich-text"

interface EditableDescriptionProps {
  taskId: string
  initialValue: string | null | undefined
  onSaved?: () => void
  placeholder?: string
  // Task title, shown in the full screen document header
  title?: string
  contentClassName?: string
}

// Task description with formatting, saved automatically while typing
export function EditableDescription({
  taskId,
  initialValue,
  onSaved,
  placeholder = "Dodaj opis...",
  title,
  contentClassName,
}: EditableDescriptionProps) {
  const saveDescription = useCallback(
    async (description: string | null) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    },
    [taskId]
  )

  return (
    <AutosaveRichText
      value={initialValue}
      onSave={saveDescription}
      onSaved={onSaved}
      placeholder={placeholder}
      title={title}
      subtitle="Opis zadania"
      contentClassName={contentClassName}
      taskSource={{ kind: "task", id: taskId }}
    />
  )
}
