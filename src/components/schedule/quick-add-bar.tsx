"use client"

import { forwardRef, useState, type FormEvent } from "react"
import { CalendarPlus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface QuickAddTaskData {
  title: string
  categoryId: string
  plannedMinutes: string
}

interface QuickAddBarProps {
  // E.g. "dziś" or "wt., 3 lis" - where the task goes
  dayLabel: string
  categories: { id: string; name: string; color: string }[]
  onAdd: (task: QuickAddTaskData) => void
  // Opens adding for another date, with what's typed so far
  onOtherDate: (task: QuickAddTaskData) => void
}

// Adds a task to the day being viewed - typed at the top of the page,
// without scrolling to the end of the list
export const QuickAddBar = forwardRef<HTMLInputElement, QuickAddBarProps>(function QuickAddBar(
  { dayLabel, categories, onAdd, onOtherDate },
  ref
) {
  const [title, setTitle] = useState("")
  // Category and time stay for the next task - several tasks are often added in a row
  const [categoryId, setCategoryId] = useState("")
  const [plannedMinutes, setPlannedMinutes] = useState("25")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), categoryId, plannedMinutes })
    setTitle("")
  }

  const handleOtherDate = () => {
    onOtherDate({ title: title.trim(), categoryId, plannedMinutes })
    setTitle("")
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="p-2 sm:p-3">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={ref}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setTitle("")
              }}
              placeholder={`Dodaj zadanie na ${dayLabel}...`}
              aria-label={`Dodaj zadanie na ${dayLabel}`}
              enterKeyHint="done"
              className="h-10 pl-9"
            />
          </div>

          {/* On a phone the options show up once something is typed */}
          <div className={cn("gap-2", title ? "flex" : "hidden sm:flex")}>
            {/* No category yet - an empty value shows the "Kategoria" placeholder */}
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-10 flex-1 min-w-0 sm:w-[170px] sm:flex-none text-sm" aria-label="Kategoria">
                <SelectValue placeholder="Kategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Brak kategorii</span>
                </SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-[84px] flex-shrink-0">
              <Input
                type="number"
                inputMode="numeric"
                min="5"
                step="5"
                value={plannedMinutes}
                onChange={(e) => setPlannedMinutes(e.target.value)}
                aria-label="Planowany czas w minutach"
                // No spin arrows - they'd cover the number next to "min"
                className="h-10 pl-3 pr-9 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                min
              </span>
            </div>
            <Button type="submit" className="h-10 flex-shrink-0" disabled={!title.trim()}>
              Dodaj
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={handleOtherDate}
              title="Dodaj na inny termin"
              aria-label="Dodaj na inny termin"
            >
              <CalendarPlus className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
})
