"use client"

import { useState, useEffect } from "react"
import { format, addMonths } from "date-fns"
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
import { useWorkspaceStore } from "@/stores/workspace-store"

interface EditPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
}

interface CreatePeriodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editPeriod?: EditPeriod | null
}

export function CreatePeriodDialog({
  open,
  onOpenChange,
  onSuccess,
  editPeriod,
}: CreatePeriodDialogProps) {
  const { workspace } = useWorkspaceStore()
  const [name, setName] = useState("")
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 3), "yyyy-MM-dd"))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const isEditMode = !!editPeriod

  // Populate form when editing
  useEffect(() => {
    if (editPeriod) {
      setName(editPeriod.name)
      setStartDate(format(new Date(editPeriod.startDate), "yyyy-MM-dd"))
      setEndDate(format(new Date(editPeriod.endDate), "yyyy-MM-dd"))
    } else {
      resetForm()
    }
  }, [editPeriod, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const url = isEditMode ? `/api/periods/${editPeriod.id}` : "/api/periods"
      const method = isEditMode ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startDate,
          endDate,
          ...(isEditMode ? {} : { workspaceType: workspace }),
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
    setEndDate(format(addMonths(new Date(), 3), "yyyy-MM-dd"))
    setError("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edytuj okres" : "Nowy okres"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Zmień nazwę lub daty okresu"
              : "Stwórz nowy okres planowania (np. kwartał, półrocze)"}
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
              <Label htmlFor="name">Nazwa okresu</Label>
              <Input
                id="name"
                placeholder="np. Q1 2025, Pierwsze półrocze"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data rozpoczęcia</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data zakończenia</Label>
                <Input
                  id="endDate"
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
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? isEditMode ? "Zapisywanie..." : "Tworzenie..."
                : isEditMode ? "Zapisz zmiany" : "Stwórz okres"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
