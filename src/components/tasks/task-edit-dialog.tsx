"use client"

import { useState, useEffect } from "react"
import { CalendarIcon, Clock, ListChecks } from "lucide-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
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
import { SubtaskList, Subtask } from "./subtask-list"
import { cn } from "@/lib/utils"

interface Category {
  id: string
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: number
  plannedMinutes?: number | null
  actualMinutes: number
  scheduledDate?: string | Date | null
  scheduledTime?: string | null
  category?: Category | null
  categoryId?: string | null
  subtasks?: Subtask[]
}

interface TaskEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  categories: Category[]
  onSave: (taskId: string, updates: Record<string, unknown>) => Promise<void>
  onSubtasksChange?: (taskId: string, subtasks: Subtask[]) => void
}

export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  categories,
  onSave,
  onSubtasksChange,
}: TaskEditDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [priority, setPriority] = useState<string>("0")
  const [plannedMinutes, setPlannedMinutes] = useState<number | undefined>()
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [scheduledTime, setScheduledTime] = useState<string>("")
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)

  // Initialize form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || "")
      setCategoryId(task.categoryId || task.category?.id || "")
      setPriority(String(task.priority))
      setPlannedMinutes(task.plannedMinutes ?? undefined)
      setScheduledDate(
        task.scheduledDate
          ? new Date(task.scheduledDate)
          : undefined
      )
      setScheduledTime(task.scheduledTime || "")
      setSubtasks(task.subtasks || [])
      setShowChecklist((task.subtasks?.length || 0) > 0)
    }
  }, [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task || !title.trim()) return

    setIsSubmitting(true)
    try {
      await onSave(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        categoryId: categoryId || null,
        priority: parseInt(priority),
        plannedMinutes: plannedMinutes ?? null,
        scheduledDate: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
        scheduledTime: scheduledTime || null,
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving task:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubtasksChange = (newSubtasks: Subtask[]) => {
    setSubtasks(newSubtasks)
    if (task && onSubtasksChange) {
      onSubtasksChange(task.id, newSubtasks)
    }
  }

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj zadanie</DialogTitle>
          <DialogDescription>
            Zmień szczegóły zadania, dodaj opis lub listę kontrolną
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Tytuł</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nazwa zadania"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dodaj szczegóły zadania..."
                rows={3}
              />
            </div>

            {/* Checklist / Subtasks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Lista kontrolna
                </Label>
                {!showChecklist && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChecklist(true)}
                  >
                    Dodaj checklistę
                  </Button>
                )}
              </div>

              {showChecklist && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <SubtaskList
                    taskId={task.id}
                    subtasks={subtasks}
                    onSubtasksChange={handleSubtasksChange}
                  />
                </div>
              )}
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Kategoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Brak kategorii</SelectItem>
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

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate
                        ? format(scheduledDate, "d MMM yyyy", { locale: pl })
                        : "Wybierz datę"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      locale={pl}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduledTime">Godzina</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="scheduledTime"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Priority and Planned time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priorytet</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Brak</SelectItem>
                    <SelectItem value="1">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Niski
                      </span>
                    </SelectItem>
                    <SelectItem value="2">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        Średni
                      </span>
                    </SelectItem>
                    <SelectItem value="3">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Wysoki
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
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
              {isSubmitting ? "Zapisywanie..." : "Zapisz zmiany"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
