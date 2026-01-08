"use client"

import { useState } from "react"
import { Layers, Plus, Trash2, ListChecks } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SubtaskInput {
  title: string
}

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
  const [plannedMinutes, setPlannedMinutes] = useState<number | undefined>()
  const [priority, setPriority] = useState<string>("0")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subtasks, setSubtasks] = useState<SubtaskInput[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [showChecklist, setShowChecklist] = useState(false)

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    setSubtasks([...subtasks, { title: newSubtaskTitle.trim() }])
    setNewSubtaskTitle("")
  }

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index))
  }

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
          // No scheduledDate - task goes to the stack
          plannedMinutes,
          priority: parseInt(priority),
          workspaceType: "WORK",
          assignedToId,
          organizationId,
        }),
      })

      if (res.ok) {
        const task = await res.json()

        // Create subtasks if any
        if (subtasks.length > 0) {
          for (const subtask of subtasks) {
            await fetch(`/api/tasks/${task.id}/subtasks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: subtask.title }),
            })
          }
        }

        setTitle("")
        setDescription("")
        setCategoryId("")
        setPlannedMinutes(undefined)
        setPriority("0")
        setSubtasks([])
        setNewSubtaskTitle("")
        setShowChecklist(false)
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
            <Alert>
              <Layers className="h-4 w-4" />
              <AlertDescription>
                Zadanie trafi do &quot;Stosu zadań&quot; przypisanej osoby. Sama zdecyduje kiedy je wykonać.
              </AlertDescription>
            </Alert>

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
                <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                  {/* Existing subtasks */}
                  {subtasks.map((subtask, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="h-4 w-4 border rounded-sm flex-shrink-0" />
                      <span className="flex-1 text-sm">{subtask.title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveSubtask(index)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {/* Add new subtask */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddSubtask()
                        }
                      }}
                      placeholder="Dodaj punkt..."
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddSubtask}
                      disabled={!newSubtaskTitle.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
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
                <Label>Priorytet</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Brak</SelectItem>
                    <SelectItem value="1">Niski</SelectItem>
                    <SelectItem value="2">Średni</SelectItem>
                    <SelectItem value="3">Wysoki</SelectItem>
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
              {isSubmitting ? "Tworzenie..." : "Przydziel zadanie"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
