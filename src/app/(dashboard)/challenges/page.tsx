"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Trash2, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useChallenges, type Challenge, type ChallengeEntry, type ChallengeInput } from "@/hooks/use-challenges"
import { useHabits } from "@/hooks/use-habits"
import { useSportTypes } from "@/hooks/use-sport"
import { addDaysKey, dayKeyOf, diffDays, todayKey } from "@/lib/tracking"
import { ChallengeCard } from "@/components/private/challenge-card"
import { CHALLENGE_IDEAS, ChallengeFormDialog, type ChallengeIdea } from "@/components/private/challenge-form-dialog"

export default function ChallengesPage() {
  const today = todayKey()
  const [showCompleted, setShowCompleted] = useState(false)
  const {
    challenges,
    isLoading,
    addEntry,
    toggleDay,
    updateEntry,
    removeEntry,
    createChallenge,
    updateChallenge,
    setCompleted,
    copyChallenge,
    removeChallenge,
  } = useChallenges(showCompleted)
  // What a challenge can be counted from
  const { habits } = useHabits()
  const { types: sportTypes } = useSportTypes()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Challenge | null>(null)
  const [idea, setIdea] = useState<ChallengeIdea | null>(null)

  const [copying, setCopying] = useState<Challenge | null>(null)
  const [copyForm, setCopyForm] = useState({ name: "", startDate: "", endDate: "", targetValue: "" })

  const [entryTarget, setEntryTarget] = useState<{ challenge: Challenge; entry: ChallengeEntry } | null>(null)
  const [entryValue, setEntryValue] = useState("")

  useEffect(() => {
    if (entryTarget) setEntryValue(entryTarget.entry.value.toString())
  }, [entryTarget])

  const openNew = (start: ChallengeIdea | null = null) => {
    setEditing(null)
    setIdea(start)
    setFormOpen(true)
  }

  const handleAddEntry = useCallback((id: string, value: number) => addEntry(id, value, today), [addEntry, today])
  const handleToggleDay = useCallback((challenge: Challenge, day: string) => toggleDay(challenge, day), [toggleDay])
  const handleEdit = useCallback((challenge: Challenge) => {
    setEditing(challenge)
    setIdea(null)
    setFormOpen(true)
  }, [])
  const handleCopy = useCallback(
    (challenge: Challenge) => {
      // The same length, starting today
      const length = diffDays(dayKeyOf(challenge.startDate), dayKeyOf(challenge.endDate))
      setCopying(challenge)
      setCopyForm({
        name: challenge.name,
        startDate: today,
        endDate: addDaysKey(today, length),
        targetValue: challenge.targetValue.toString(),
      })
    },
    [today]
  )
  const handleDelete = useCallback(
    (challenge: Challenge) => {
      if (confirm(`Usunąć wyzwanie "${challenge.name}"?`)) removeChallenge(challenge.id)
    },
    [removeChallenge]
  )
  const handleSetCompleted = useCallback(
    (challenge: Challenge, isCompleted: boolean) => setCompleted(challenge.id, isCompleted),
    [setCompleted]
  )
  const handleEditEntry = useCallback(
    (challenge: Challenge, entry: ChallengeEntry) => setEntryTarget({ challenge, entry }),
    []
  )

  const handleSubmit = (input: ChallengeInput) =>
    editing ? updateChallenge(editing.id, input) : createChallenge(input)

  const submitCopy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!copying) return
    if (await copyChallenge(copying.id, copyForm)) setCopying(null)
  }

  const submitEntry = (e: React.FormEvent) => {
    e.preventDefault()
    if (!entryTarget) return
    const value = parseFloat(entryValue.replace(",", "."))
    if (!Number.isFinite(value)) return
    updateEntry(entryTarget.challenge.id, entryTarget.entry.id, value)
    setEntryTarget(null)
  }

  const active = challenges.filter((c) => !c.isCompleted)
  const reached = challenges.filter((c) => c.currentValue >= c.targetValue).length
  const closed = challenges.filter((c) => c.isCompleted)

  return (
    <div className="space-y-4 animate-fade-in md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Wyzwania</h1>
          <p className="text-sm text-muted-foreground md:text-base">Cele z terminem - i czy idziesz zgodnie z planem</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <label className="flex min-h-[2.75rem] items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
            Pokaż zakończone
          </label>
          <Button className="h-11" onClick={() => openNew()}>
            <Plus className="mr-2 h-4 w-4" />
            Nowe wyzwanie
          </Button>
        </div>
      </div>

      {challenges.length > 0 && (
        <Card>
          <CardContent className="flex items-center gap-8 p-4">
            <div>
              <div className="text-xs text-muted-foreground md:text-sm">Aktywne</div>
              <div className="text-2xl font-bold tabular-nums">{active.length}</div>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-xs text-muted-foreground md:text-sm">Cel osiągnięty</div>
                <div className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{reached}</div>
              </div>
            </div>
            {showCompleted && (
              <div>
                <div className="text-xs text-muted-foreground md:text-sm">Zakończone</div>
                <div className="text-2xl font-bold tabular-nums">{closed.length}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading && challenges.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 flex-shrink-0 text-muted-foreground/60" />
              <div>
                <p className="font-medium">{showCompleted ? "Brak wyzwań" : "Brak aktywnych wyzwań"}</p>
                <p className="text-sm text-muted-foreground">
                  Wyzwanie to cel z terminem. Może liczyć się samo - z Twoich treningów, nawyków albo kroków.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_IDEAS.map((start) => (
                <button
                  key={start.label}
                  type="button"
                  onClick={() => openNew(start)}
                  className="flex h-11 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm transition-colors active:bg-accent md:hover:bg-accent/60"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  {start.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              today={today}
              onAddEntry={handleAddEntry}
              onToggleDay={handleToggleDay}
              onEdit={handleEdit}
              onCopy={handleCopy}
              onDelete={handleDelete}
              onSetCompleted={handleSetCompleted}
              onEditEntry={handleEditEntry}
            />
          ))}
        </div>
      )}

      <ChallengeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        challenge={editing}
        idea={idea}
        habits={habits}
        sportTypes={sportTypes}
        onSubmit={handleSubmit}
      />

      {/* Repeat a challenge with new dates */}
      <Dialog open={!!copying} onOpenChange={(open) => !open && setCopying(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Powtórz wyzwanie</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCopy} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="copy-name">Nazwa</Label>
              <Input
                id="copy-name"
                value={copyForm.name}
                onChange={(e) => setCopyForm({ ...copyForm, name: e.target.value })}
                className="h-11 text-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="copy-start">Od</Label>
                <Input
                  id="copy-start"
                  type="date"
                  value={copyForm.startDate}
                  onChange={(e) => setCopyForm({ ...copyForm, startDate: e.target.value })}
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="copy-end">Do</Label>
                <Input
                  id="copy-end"
                  type="date"
                  value={copyForm.endDate}
                  min={copyForm.startDate}
                  onChange={(e) => setCopyForm({ ...copyForm, endDate: e.target.value })}
                  className="h-11 text-base"
                />
              </div>
            </div>
            {copying?.challengeType === "NUMERIC" && (
              <div className="space-y-1.5">
                <Label htmlFor="copy-target">Cel ({copying.unit})</Label>
                <Input
                  id="copy-target"
                  type="text"
                  inputMode="decimal"
                  value={copyForm.targetValue}
                  onChange={(e) => setCopyForm({ ...copyForm, targetValue: e.target.value })}
                  className="h-11 text-base"
                />
              </div>
            )}
            <Button type="submit" className="h-11 w-full" disabled={!copyForm.name.trim() || !copyForm.startDate || !copyForm.endDate}>
              Utwórz kopię
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change or delete an entry */}
      <Dialog open={!!entryTarget} onOpenChange={(open) => !open && setEntryTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Wpis: {entryTarget?.challenge.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEntry} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="entry-value">Wartość ({entryTarget?.challenge.unit})</Label>
              <Input
                id="entry-value"
                type="text"
                inputMode="decimal"
                value={entryValue}
                onChange={(e) => setEntryValue(e.target.value)}
                className="h-12 text-lg"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 flex-shrink-0 text-destructive hover:text-destructive"
                aria-label="Usuń wpis"
                onClick={() => {
                  if (entryTarget) removeEntry(entryTarget.challenge.id, entryTarget.entry.id)
                  setEntryTarget(null)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button type="submit" className="h-11 flex-1">
                Zapisz
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
