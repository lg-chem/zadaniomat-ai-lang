"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { AlertTriangle, ArrowRight, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { quarterRequest } from "@/hooks/use-quarter"
import { formatNumber, RECOMMENDED_MAX_GOALS, type QuarterGoal } from "@/lib/quarters"
import { parseDecimal } from "./goal-card"

interface Category {
  id: string
  name: string
  color: string
}

interface KeyResultDraft {
  key: string
  id?: string
  title: string
  unit: string
  startValue: string
  targetValue: string
}

export interface GoalPrefill {
  title: string
  categoryId: string | null
  carriedFromGoalId?: string
}

let draftCounter = 0
const newDraft = (): KeyResultDraft => ({
  key: `kr-${++draftCounter}`,
  title: "",
  unit: "",
  startValue: "0",
  targetValue: "",
})

const numberText = (value: number) => formatNumber(value).replace(/\s/g, "")

export function GoalDialog({
  open,
  onOpenChange,
  quarterId,
  quarterName,
  goal,
  prefill,
  goalsCount,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quarterId: string
  quarterName: string
  goal: QuarterGoal | null
  prefill?: GoalPrefill | null
  goalsCount: number
  onSaved: () => void
}) {
  const { data: categories = [] } = useSWR<Category[]>(open ? "/api/categories?workspace=WORK" : null)

  const [title, setTitle] = useState("")
  const [why, setWhy] = useState("")
  const [keyResults, setKeyResults] = useState<KeyResultDraft[]>([])
  const [leadMeasure, setLeadMeasure] = useState("")
  const [leadTarget, setLeadTarget] = useState("")
  const [obstacle, setObstacle] = useState("")
  const [ifThenPlan, setIfThenPlan] = useState("")
  const [categoryId, setCategoryId] = useState<string>("none")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(goal?.title ?? prefill?.title ?? "")
    setWhy(goal?.why ?? "")
    setKeyResults(
      goal && goal.keyResults.length > 0
        ? goal.keyResults.map((kr) => ({
            key: kr.id,
            id: kr.id,
            title: kr.title,
            unit: kr.unit ?? "",
            startValue: numberText(kr.startValue),
            targetValue: numberText(kr.targetValue),
          }))
        : [newDraft()]
    )
    setLeadMeasure(goal?.leadMeasure ?? "")
    setLeadTarget(goal?.leadTarget != null ? numberText(goal.leadTarget) : "")
    setObstacle(goal?.obstacle ?? "")
    setIfThenPlan(goal?.ifThenPlan ?? "")
    setCategoryId(goal?.category?.id ?? prefill?.categoryId ?? "none")
  }, [open, goal, prefill])

  const updateKeyResult = (key: string, patch: Partial<KeyResultDraft>) =>
    setKeyResults((prev) => prev.map((kr) => (kr.key === key ? { ...kr, ...patch } : kr)))

  const filledKeyResults = keyResults.filter((kr) => kr.title.trim() || kr.targetValue.trim())
  const tooManyGoals = !goal && goalsCount >= RECOMMENDED_MAX_GOALS

  const save = async () => {
    if (!title.trim()) {
      toast.error("Wpisz cel")
      return
    }

    const krPayload = []
    for (const kr of filledKeyResults) {
      const startValue = parseDecimal(kr.startValue) ?? 0
      const targetValue = parseDecimal(kr.targetValue)
      if (!kr.title.trim() || targetValue === null) {
        toast.error("Każdy rezultat potrzebuje nazwy i wartości docelowej")
        return
      }
      krPayload.push({
        id: kr.id,
        title: kr.title.trim(),
        unit: kr.unit.trim() || null,
        startValue,
        targetValue,
      })
    }

    const parsedLeadTarget = parseDecimal(leadTarget)
    const body = {
      title: title.trim(),
      why: why.trim() || null,
      obstacle: obstacle.trim() || null,
      ifThenPlan: ifThenPlan.trim() || null,
      leadMeasure: leadMeasure.trim() || null,
      leadTarget: leadMeasure.trim() && parsedLeadTarget && parsedLeadTarget > 0 ? parsedLeadTarget : null,
      categoryId: categoryId === "none" ? null : categoryId,
      keyResults: krPayload,
    }

    setSaving(true)
    try {
      if (goal) {
        await quarterRequest(`/api/quarter-goals/${goal.id}`, "PATCH", body)
        toast.success("Cel zapisany")
      } else {
        await quarterRequest(`/api/quarters/${quarterId}/goals`, "POST", {
          ...body,
          carriedFromGoalId: prefill?.carriedFromGoalId,
        })
        toast.success("Cel dodany")
      }
      onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać celu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{goal ? "Edytuj cel" : `Nowy cel na ${quarterName}`}</DialogTitle>
          <DialogDescription>
            Dobry cel ma liczbę, działanie, które zależy od Ciebie, i plan na najbardziej prawdopodobną przeszkodę.
          </DialogDescription>
        </DialogHeader>

        {tooManyGoals && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Masz już {goalsCount} {goalsCount === 1 ? "cel" : goalsCount < 5 ? "cele" : "celów"} w tym kwartale.
              Każdy kolejny zabiera uwagę pozostałym. Zastanów się, czy ten nie może poczekać na następny kwartał.
            </p>
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Cel</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Marketing, który sam przyprowadza klientów"
              autoFocus={!goal}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-why">
              Dlaczego to ważne? <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
            </Label>
            <Textarea
              id="goal-why"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Jedno zdanie, które przypomni Ci o sensie w słabszym tygodniu"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div>
              <Label>Po czym poznasz, że się udało?</Label>
              <p className="text-xs text-muted-foreground">
                1–3 liczby: wartość na start → cel na koniec kwartału. Aktualizujesz je w cotygodniowym check-inie.
              </p>
            </div>
            <div className="space-y-2">
              {keyResults.map((kr, i) => (
                <div key={kr.key} className="space-y-2 rounded-md border p-3">
                  <div className="flex gap-2">
                    <Input
                      value={kr.title}
                      onChange={(e) => updateKeyResult(kr.key, { title: e.target.value })}
                      placeholder={i === 0 ? "np. Nowi klienci z marketingu" : "Nazwa rezultatu"}
                      aria-label="Nazwa rezultatu"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setKeyResults((prev) => prev.filter((k) => k.key !== kr.key))}
                      aria-label="Usuń rezultat"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={kr.startValue}
                      onChange={(e) => updateKeyResult(kr.key, { startValue: e.target.value })}
                      inputMode="decimal"
                      className="w-20 text-right"
                      aria-label="Wartość na start"
                      placeholder="0"
                    />
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={kr.targetValue}
                      onChange={(e) => updateKeyResult(kr.key, { targetValue: e.target.value })}
                      inputMode="decimal"
                      className="w-24 text-right"
                      aria-label="Cel na koniec kwartału"
                      placeholder="np. 7"
                    />
                    <Input
                      value={kr.unit}
                      onChange={(e) => updateKeyResult(kr.key, { unit: e.target.value })}
                      className="min-w-0 flex-1"
                      aria-label="Jednostka"
                      placeholder="jednostka, np. klientów"
                    />
                  </div>
                </div>
              ))}
              {keyResults.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setKeyResults((prev) => [...prev, newDraft()])}
                >
                  <Plus className="mr-1 h-4 w-4" /> Dodaj rezultat
                </Button>
              )}
              {filledKeyResults.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Bez liczby nie zobaczysz tempa. Jeśli to nowy obszar i nie wiesz jeszcze jak, wpisz cel nauki,
                  np. „Przetestowane kanały pozyskania: 0 → 3”.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label>
                Działanie tygodniowe <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Co zależy wyłącznie od Ciebie i napędza wynik? Liczysz je w check-inie.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={leadMeasure}
                onChange={(e) => setLeadMeasure(e.target.value)}
                placeholder="np. Rozmowy z potencjalnymi klientami"
                className="min-w-0 flex-1"
                aria-label="Działanie tygodniowe"
              />
              <Input
                value={leadTarget}
                onChange={(e) => setLeadTarget(e.target.value)}
                inputMode="decimal"
                placeholder="20"
                className="w-20 text-right"
                aria-label="Ile razy w tygodniu"
              />
              <span className="shrink-0 text-sm text-muted-foreground">/ tydz.</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-obstacle">
              Co najpewniej Cię zatrzyma? <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
            </Label>
            <Input
              id="goal-obstacle"
              value={obstacle}
              onChange={(e) => setObstacle(e.target.value)}
              placeholder="np. Bieżąca obsługa zjada cały dzień"
            />
            <Input
              value={ifThenPlan}
              onChange={(e) => setIfThenPlan(e.target.value)}
              placeholder="Jeśli …, to … (np. Jeśli do 10:00 nie zadzwoniłem do nikogo, to robię 5 telefonów przed mailami)"
              aria-label="Plan jeśli-to"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Kategoria <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Bez kategorii" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez kategorii</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Zapisywanie…" : goal ? "Zapisz" : "Dodaj cel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
