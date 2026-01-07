"use client"

import { useState, useEffect } from "react"
import { format, addWeeks } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface EditSprint {
  id: string
  name: string
  startDate: string
  endDate: string
}

interface CreateSprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodId: string | null
  onSuccess: () => void
  editSprint?: EditSprint | null
}

export function CreateSprintDialog({
  open,
  onOpenChange,
  periodId,
  onSuccess,
  editSprint,
}: CreateSprintDialogProps) {
  const [name, setName] = useState("")
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(addWeeks(new Date(), 2), "yyyy-MM-dd"))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const isEditMode = !!editSprint

  // Populate form when editing
  useEffect(() => {
    if (editSprint) {
      setName(editSprint.name)
      setStartDate(format(new Date(editSprint.startDate), "yyyy-MM-dd"))
      setEndDate(format(new Date(editSprint.endDate), "yyyy-MM-dd"))
    } else {
      resetForm()
    }
  }, [editSprint, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodId && !isEditMode) return

    setError("")
    setIsLoading(true)

    try {
      const url = isEditMode ? `/api/sprints/${editSprint.id}` : "/api/sprints"
      const method = isEditMode ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startDate,
          endDate,
          ...(isEditMode ? {} : { periodId }),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Wystąpił błąd")
      }

      onSuccess()
      onOpenChange(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setName("")
    setStartDate(format(new Date(), "yyyy-MM-dd"))
    setEndDate(format(addWeeks(new Date(), 2), "yyyy-MM-dd"))
    setError("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edytuj sprint" : "Nowy sprint"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Zmień nazwę lub daty sprintu"
              : "Stwórz nowy sprint (domyślnie 2 tygodnie)"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sprintName">Nazwa sprintu</Label>
              <Input
                id="sprintName"
                placeholder="np. Sprint 1, Styczeń W1-W2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sprintStartDate">Data rozpoczęcia</Label>
                <Input
                  id="sprintStartDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprintEndDate">Data zakończenia</Label>
                <Input
                  id="sprintEndDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isLoading || (!periodId && !isEditMode)}>
              {isLoading
                ? isEditMode ? "Zapisywanie..." : "Tworzenie..."
                : isEditMode ? "Zapisz zmiany" : "Stwórz sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
