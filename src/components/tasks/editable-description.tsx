"use client"

import { useState, useEffect } from "react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface EditableDescriptionProps {
  taskId: string
  initialValue: string | null | undefined
  onSaved?: () => void
  placeholder?: string
  rows?: number
}

export function EditableDescription({
  taskId,
  initialValue,
  onSaved,
  placeholder = "Dodaj opis...",
  rows = 2,
}: EditableDescriptionProps) {
  const [value, setValue] = useState(initialValue || "")
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Sync with external value changes
  useEffect(() => {
    setValue(initialValue || "")
    setHasChanges(false)
  }, [initialValue])

  const handleChange = (newValue: string) => {
    setValue(newValue)
    setHasChanges(newValue !== (initialValue || ""))
  }

  const handleSave = async () => {
    if (!hasChanges) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value || null }),
      })

      if (res.ok) {
        setHasChanges(false)
        onSaved?.()
      }
    } catch (error) {
      console.error("Error saving description:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="text-sm"
      />
      {hasChanges && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 text-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Zapisuję...
              </>
            ) : (
              <>
                <Check className="h-3 w-3 mr-1" />
                Zapisz opis
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
