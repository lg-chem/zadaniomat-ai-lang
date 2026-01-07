"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface Category {
  id: string
  name: string
  color: string
}

interface AssignTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  assignedToId: string | null
  categories: Category[]
  onSuccess: () => void
}

export function AssignTaskDialog({
  open,
  onOpenChange,
  organizationId,
  assignedToId,
  categories,
  onSuccess,
}: AssignTaskDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date())
  const [plannedMinutes, setPlannedMinutes] = useState<number | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !assignedToId) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categoryId: categoryId || undefined,
          scheduledDate: scheduledDate?.toISOString(),
          plannedMinutes,
          workspaceType: "WORK",
          assignedToId,
          organizationId,
        }),
      })

      if (res.ok) {
        setTitle("")
        setDescription("")
        setCategoryId("")
        setScheduledDate(new Date())
        setPlannedMinutes(undefined)
        onOpenChange(false)
        onSuccess()
      }
    } catch (error) {
      console.error("Error creating task:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Przydziel zadanie</DialogTitle>
          <DialogDescription>
            Utwórz nowe zadanie i przydziel je wybranemu członkowi zespołu
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Tytuł zadania</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Co ma być zrobione?"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis (opcjonalnie)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Szczegóły zadania..."
                rows={3}
              />
            </div>

            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Kategoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? (
                        format(scheduledDate, "dd.MM.yyyy")
                      ) : (
                        <span>Wybierz datę</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plannedMinutes">Planowany czas (min)</Label>
                <Input
                  id="plannedMinutes"
                  type="number"
                  min={1}
                  value={plannedMinutes || ""}
                  onChange={(e) =>
                    setPlannedMinutes(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="np. 30"
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
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Tworzenie..." : "Przydziel zadanie"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
