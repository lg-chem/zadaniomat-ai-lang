"use client"

import { useState, useRef } from "react"
import { Plus, X, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBacklog } from "@/hooks/use-backlog"

export function BacklogQuickAddBubble() {
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddContent, setQuickAddContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const quickAddRef = useRef<HTMLInputElement>(null)
  const { mutate } = useBacklog()

  const handleQuickAdd = async () => {
    if (!quickAddContent.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: quickAddContent,
          workspaceType: "WORK",
        }),
      })
      if (res.ok) {
        mutate()
        setQuickAddContent("")
        setShowQuickAdd(false)
      }
    } catch (error) {
      console.error("Error creating item:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {showQuickAdd ? (
        <div className="bg-background border rounded-lg shadow-lg p-3 w-80">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Szybka notatka</span>
          </div>
          <Input
            ref={quickAddRef}
            value={quickAddContent}
            onChange={(e) => setQuickAddContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleQuickAdd()
              }
              if (e.key === "Escape") {
                setShowQuickAdd(false)
                setQuickAddContent("")
              }
            }}
            placeholder="Wpisz pomysł..."
            className="mb-2"
            autoFocus
            disabled={isSubmitting}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleQuickAdd}
              disabled={!quickAddContent.trim() || isSubmitting}
            >
              <Plus className="h-4 w-4 mr-1" />
              {isSubmitting ? "Dodaję..." : "Dodaj"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowQuickAdd(false)
                setQuickAddContent("")
              }}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => {
            setShowQuickAdd(true)
            setTimeout(() => quickAddRef.current?.focus(), 0)
          }}
          title="Szybka notatka do backlogu"
        >
          <Lightbulb className="h-6 w-6" />
        </Button>
      )}
    </div>
  )
}
