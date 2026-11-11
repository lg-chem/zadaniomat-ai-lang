"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { BODY_PARTS, type SportActivity, type SportActivityType } from "@/hooks/use-sport"
import { dayKeyOf } from "@/lib/tracking"

const DURATION_CHIPS = [30, 45, 60, 75, 90, 120]

export interface ActivityFormValues {
  type: SportActivityType
  day: string
  duration: number | null
  notes: string | null
  bodyParts: string[]
  isPublic: boolean
}

export type ActivityDialogTarget =
  | { mode: "new"; day: string; type?: SportActivityType }
  | { mode: "edit"; activity: SportActivity }

interface ActivityDialogProps {
  /** What is being added / changed; null - closed */
  target: ActivityDialogTarget | null
  types: SportActivityType[]
  onClose: () => void
  onSave: (values: ActivityFormValues, activityId?: string) => void
  onDelete?: (activityId: string) => void
}

/** A workout: what, when, how long, which muscles (gym), a note */
export function ActivityDialog({ target, types, onClose, onSave, onDelete }: ActivityDialogProps) {
  const [typeId, setTypeId] = useState("")
  const [day, setDay] = useState("")
  const [duration, setDuration] = useState("")
  const [notes, setNotes] = useState("")
  const [bodyParts, setBodyParts] = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(false)

  const editing = target?.mode === "edit" ? target.activity : null

  useEffect(() => {
    if (!target) return
    if (target.mode === "edit") {
      const a = target.activity
      setTypeId(a.type.id)
      setDay(dayKeyOf(a.date))
      setDuration(a.duration?.toString() ?? "")
      setNotes(a.notes ?? "")
      setBodyParts(a.bodyParts.map((p) => p.name))
      setIsPublic(!!a.isPublic)
    } else {
      setTypeId(target.type?.id ?? "")
      setDay(target.day)
      setDuration("")
      setNotes("")
      setBodyParts([])
      // Private unless shared on purpose
      setIsPublic(false)
    }
    // Filled once per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.mode, editing?.id, target?.mode === "new" ? target.type?.id : null, target?.mode === "new" ? target.day : null])

  if (!target) return null

  const type = types.find((t) => t.id === typeId) ?? editing?.type ?? (target.mode === "new" ? target.type : undefined)

  const toggleBodyPart = (part: string) =>
    setBodyParts((parts) => (parts.includes(part) ? parts.filter((p) => p !== part) : [...parts, part]))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!type || !day) return
    onSave(
      {
        type,
        day,
        duration: duration ? parseInt(duration) || null : null,
        notes: notes.trim() || null,
        bodyParts: type.hasBodyParts ? bodyParts : [],
        isPublic,
      },
      editing?.id
    )
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Trening" : "Nowy trening"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Co</Label>
            <div className="flex flex-wrap gap-1.5">
              {/* "Kroki" is the type of walks copied from the steps - offered only where it is already set */}
              {types.filter((t) => t.name !== "Kroki" || t.id === typeId).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeId(t.id)}
                  className={cn(
                    "h-10 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    t.id === typeId ? "border-transparent text-white" : "text-foreground"
                  )}
                  style={t.id === typeId ? { backgroundColor: t.color } : undefined}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {type?.hasBodyParts && (
            <div className="space-y-1.5">
              <Label>Partie</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {BODY_PARTS.map((part) => (
                  <button
                    key={part}
                    type="button"
                    onClick={() => toggleBodyPart(part)}
                    aria-pressed={bodyParts.includes(part)}
                    className={cn(
                      "h-11 rounded-lg border text-sm transition-colors",
                      bodyParts.includes(part) ? "border-foreground bg-foreground text-background" : "text-foreground"
                    )}
                  >
                    {part}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="activity-duration">Czas (min)</Label>
            <Input
              id="activity-duration"
              type="number"
              inputMode="numeric"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="bez czasu"
              className="h-11 text-base"
            />
            <div className="flex flex-wrap gap-1.5">
              {DURATION_CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDuration(value.toString())}
                  className={cn(
                    "h-9 min-w-[2.75rem] rounded-full border px-2 text-sm tabular-nums transition-colors",
                    duration === value.toString() ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="activity-day">Dzień</Label>
              <Input
                id="activity-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-notes">Notatka</Label>
              <Input
                id="activity-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="np. droga 6a, 40 basenów"
                className="h-11 text-base"
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm">
              <span className="font-medium">Widoczny dla znajomych</span>
              <span className="block text-xs text-muted-foreground">Wyłączone - widzisz go tylko Ty</span>
            </span>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </label>

          <div className="flex gap-2">
            {editing && onDelete && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 flex-shrink-0 text-destructive hover:text-destructive"
                aria-label="Usuń trening"
                onClick={() => {
                  onDelete(editing.id)
                  onClose()
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button type="submit" className="h-11 flex-1" disabled={!type || !day}>
              {editing ? "Zapisz" : "Dodaj trening"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
