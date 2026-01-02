"use client"

import { useState, useRef } from "react"
import { Plus, X, StickyNote, Bug, Lightbulb, Send, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useBacklog } from "@/hooks/use-backlog"

type ReportMode = "backlog" | "admin"
type ReportType = "BUG" | "FEATURE" | "OTHER"
type FeedbackType = "success" | "error" | null

export function BacklogQuickAddBubble() {
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddContent, setQuickAddContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<ReportMode>("backlog")
  const [reportType, setReportType] = useState<ReportType>("BUG")
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string } | null>(null)
  const quickAddRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { mutate } = useBacklog()

  const showFeedback = (type: FeedbackType, message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleQuickAdd = async () => {
    if (!quickAddContent.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      if (mode === "backlog") {
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
          showFeedback("success", "Dodano do backlogu")
        }
      } else {
        const res = await fetch("/api/admin/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: quickAddContent,
            type: reportType,
          }),
        })
        if (res.ok) {
          showFeedback("success", "Zgłoszenie wysłane!")
        } else {
          throw new Error("Failed to send report")
        }
      }
      setQuickAddContent("")
      setShowQuickAdd(false)
    } catch (error) {
      console.error("Error:", error)
      showFeedback("error", "Wystąpił błąd")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setShowQuickAdd(false)
    setQuickAddContent("")
    setMode("backlog")
    setReportType("BUG")
  }

  return (
    <div className="fixed bottom-32 md:bottom-6 right-4 md:right-6 z-50">
      {showQuickAdd ? (
        <div className="bg-background border rounded-lg shadow-lg p-3 w-72 md:w-80">
          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-md mb-3">
            <button
              type="button"
              className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                mode === "backlog"
                  ? "bg-background shadow-sm text-yellow-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("backlog")}
            >
              <StickyNote className="h-3 w-3" />
              Backlog
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                mode === "admin"
                  ? "bg-background shadow-sm text-blue-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("admin")}
            >
              <Send className="h-3 w-3" />
              Zgłoś do admina
            </button>
          </div>

          {mode === "backlog" ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Szybka notatka</span>
              </div>
              <Input
                ref={quickAddRef}
                value={quickAddContent}
                onChange={(e) => setQuickAddContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickAdd()
                  if (e.key === "Escape") handleClose()
                }}
                placeholder="Wpisz pomysł..."
                className="mb-2"
                autoFocus
                disabled={isSubmitting}
              />
            </>
          ) : (
            <>
              {/* Report Type Selection */}
              <div className="flex gap-1 mb-2">
                <button
                  type="button"
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 border ${
                    reportType === "BUG"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "border-transparent hover:bg-muted"
                  }`}
                  onClick={() => setReportType("BUG")}
                >
                  <Bug className="h-3 w-3" />
                  Błąd
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 border ${
                    reportType === "FEATURE"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "border-transparent hover:bg-muted"
                  }`}
                  onClick={() => setReportType("FEATURE")}
                >
                  <Lightbulb className="h-3 w-3" />
                  Pomysł
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 border ${
                    reportType === "OTHER"
                      ? "bg-gray-50 border-gray-200 text-gray-700"
                      : "border-transparent hover:bg-muted"
                  }`}
                  onClick={() => setReportType("OTHER")}
                >
                  Inne
                </button>
              </div>
              <Textarea
                ref={textareaRef}
                value={quickAddContent}
                onChange={(e) => setQuickAddContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") handleClose()
                }}
                placeholder={
                  reportType === "BUG"
                    ? "Opisz błąd..."
                    : reportType === "FEATURE"
                    ? "Opisz pomysł na ficzer..."
                    : "Wpisz treść zgłoszenia..."
                }
                className="mb-2 min-h-[80px] text-sm"
                autoFocus
                disabled={isSubmitting}
              />
            </>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              className={`flex-1 ${mode === "admin" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              onClick={handleQuickAdd}
              disabled={!quickAddContent.trim() || isSubmitting}
            >
              {mode === "backlog" ? (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  {isSubmitting ? "Dodaję..." : "Dodaj"}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  {isSubmitting ? "Wysyłam..." : "Wyślij"}
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="lg"
          className="h-12 w-12 md:h-14 md:w-14 rounded-full shadow-lg bg-yellow-500 hover:bg-yellow-600"
          onClick={() => {
            setShowQuickAdd(true)
            setTimeout(() => quickAddRef.current?.focus(), 0)
          }}
          title="Szybka notatka / Zgłoś do admina"
        >
          <div className="relative">
            <StickyNote className="h-5 w-5 md:h-6 md:w-6" />
            <Plus className="h-2.5 w-2.5 md:h-3 md:w-3 absolute -top-1 -right-1 bg-yellow-600 rounded-full" />
          </div>
        </Button>
      )}

      {/* Feedback notification */}
      {feedback && (
        <div
          className={`fixed bottom-20 md:bottom-24 right-4 md:right-6 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${
            feedback.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {feedback.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {feedback.message}
        </div>
      )}
    </div>
  )
}
