"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { AlertTriangle, History, Plus, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { quarterRequest } from "@/hooks/use-quarter"
import {
  dayKeyToLocalDate,
  formatNumber,
  goalProgress,
  paceStatus,
  RECOMMENDED_MAX_COMMITMENTS,
  type QuarterGoal,
  type QuarterPayload,
  type QuarterSprint,
  type SprintHistory,
} from "@/lib/quarters"
import { PaceBadge } from "./pace"

interface CommitmentDraft {
  key: string
  id?: string
  title: string
  parentGoalId: string | null
}

let draftCounter = 0
const OTHER = "other"
const shortDate = (key: string) => format(dayKeyToLocalDate(key), "d MMM", { locale: pl })

function GoalBlock({
  goal,
  elapsed,
  items,
  newTitle,
  setNewTitle,
  onChangeItem,
  onRemoveItem,
  onAdd,
}: {
  goal: QuarterGoal | null
  elapsed: number
  items: CommitmentDraft[]
  newTitle: string
  setNewTitle: (title: string) => void
  onChangeItem: (key: string, title: string) => void
  onRemoveItem: (key: string) => void
  onAdd: (title: string) => void
}) {
  const progress = goal ? goalProgress(goal.keyResults) : null

  const add = () => {
    if (newTitle.trim()) onAdd(newTitle.trim())
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: goal?.category?.color ?? "hsl(var(--muted-foreground))" }}
        />
        <span className="min-w-0 flex-1 text-sm font-medium">{goal ? goal.title : "Poza celami kwartału"}</span>
        {progress !== null && <PaceBadge status={paceStatus(progress, elapsed)} />}
      </div>
      {goal && goal.keyResults.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {goal.keyResults
            .map((kr) => `${kr.title}: ${formatNumber(kr.currentValue)}/${formatNumber(kr.targetValue)}${kr.unit ? ` ${kr.unit}` : ""}`)
            .join(" · ")}
        </p>
      )}
      {items.map((item) => (
        <div key={item.key} className="flex gap-1.5">
          <Input
            value={item.title}
            onChange={(e) => onChangeItem(item.key, e.target.value)}
            className="h-9"
            aria-label="Zobowiązanie"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => onRemoveItem(item.key)}
            aria-label="Usuń zobowiązanie"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={goal ? "Dodaj zobowiązanie, np. Odpalić kampanię na Meta" : "Coś spoza celów (lepiej unikać)"}
          className="h-9"
          aria-label="Nowe zobowiązanie"
        />
        <Button type="submit" variant="secondary" size="icon" className="h-9 w-9 shrink-0" disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}

export function SprintPlanDialog({
  open,
  onOpenChange,
  quarter,
  sprint,
  history,
  elapsed,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quarter: QuarterPayload
  sprint: QuarterSprint | null
  history: SprintHistory
  elapsed: number
  onSaved: () => void
}) {
  const [sprintGoal, setSprintGoal] = useState("")
  const [items, setItems] = useState<CommitmentDraft[]>([])
  // Text typed in the "add" inputs but not added yet - saved too, so nothing gets lost
  const [pending, setPending] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !sprint) return
    setSprintGoal(sprint.sprintGoal ?? "")
    setPending({})
    setItems(
      sprint.commitments.map((c) => ({
        key: c.id,
        id: c.id,
        title: c.title,
        parentGoalId: quarter.goals.some((g) => g.id === c.parentGoalId) ? c.parentGoalId : null,
      }))
    )
  }, [open, sprint, quarter.goals])

  if (!sprint) return null

  const index = quarter.sprints.findIndex((s) => s.id === sprint.id)
  const previous = index > 0 ? quarter.sprints[index - 1] : null
  const previousChange = previous?.retrospective?.actionItems[0]
  const goals = quarter.goals.filter((g) => !g.isCompleted || items.some((i) => i.parentGoalId === g.id))
  const itemsFor = (goalId: string | null) => items.filter((i) => i.parentGoalId === goalId)
  const pendingItems: CommitmentDraft[] = Object.entries(pending)
    .filter(([, title]) => title.trim())
    .map(([group, title]) => ({ key: `pending-${group}`, title, parentGoalId: group === OTHER ? null : group }))
  const allItems = [...items, ...pendingItems].filter((i) => i.title.trim())
  const count = allItems.length
  const historyRate = history.total > 0 ? Math.round((history.done / history.total) * 100) : null

  const addItem = (parentGoalId: string | null, title: string) => {
    setItems((prev) => [...prev, { key: `new-${++draftCounter}`, title, parentGoalId }])
    setPending((prev) => ({ ...prev, [parentGoalId ?? OTHER]: "" }))
  }
  const changeItem = (key: string, title: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, title } : i)))
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key))

  const save = async () => {
    setSaving(true)
    try {
      await quarterRequest(`/api/sprints/${sprint.id}/plan`, "PUT", {
        sprintGoal: sprintGoal.trim() || null,
        commitments: allItems.map((i) => ({ id: i.id, title: i.title.trim(), parentGoalId: i.parentGoalId })),
      })
      toast.success(`Plan ${sprint.name} zapisany`)
      onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać planu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Planowanie: {sprint.name}</DialogTitle>
          <DialogDescription>
            {shortDate(sprint.startKey)} – {shortDate(sprint.endKey)}. Jeden cel sprintu i 3–5 zobowiązań. Każde
            powinno popychać któryś cel kwartału.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {previousChange && (
            <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                <span className="font-medium">Zmiana zapisana w retro {previous?.name}:</span>{" "}
                {previousChange}
              </p>
            </div>
          )}
          {historyRate !== null && (
            <div className="flex gap-2 rounded-md bg-muted/60 p-3 text-sm">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p>
                Ostatnie sprinty ({history.sprints}): domknięte {history.done} z {history.total} zobowiązań (
                {historyRate}%). Planuj z tym zapasem.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sprint-goal">Cel sprintu</Label>
            <Input
              id="sprint-goal"
              value={sprintGoal}
              onChange={(e) => setSprintGoal(e.target.value)}
              placeholder="Co ma być prawdą za 2 tygodnie? np. Kampania działa i dała pierwsze 3 leady"
            />
          </div>

          <div className="space-y-3">
            <Label>Zobowiązania</Label>
            {goals.map((goal) => (
              <GoalBlock
                key={goal.id}
                goal={goal}
                elapsed={elapsed}
                items={itemsFor(goal.id)}
                newTitle={pending[goal.id] ?? ""}
                setNewTitle={(title) => setPending((prev) => ({ ...prev, [goal.id]: title }))}
                onChangeItem={changeItem}
                onRemoveItem={removeItem}
                onAdd={(title) => addItem(goal.id, title)}
              />
            ))}
            <GoalBlock
              key={OTHER}
              goal={null}
              elapsed={elapsed}
              items={itemsFor(null)}
              newTitle={pending[OTHER] ?? ""}
              setNewTitle={(title) => setPending((prev) => ({ ...prev, [OTHER]: title }))}
              onChangeItem={changeItem}
              onRemoveItem={removeItem}
              onAdd={(title) => addItem(null, title)}
            />
          </div>

          {count > RECOMMENDED_MAX_COMMITMENTS && (
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {count} zobowiązań na 2 tygodnie to dużo. Ludzie regularnie przeceniają, ile zrobią. Zostaw te, bez
                których sprint nie ma sensu.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground">Zobowiązań: {count}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz plan"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
