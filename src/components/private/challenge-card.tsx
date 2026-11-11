"use client"

import { memo, useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Archive,
  Check,
  Copy,
  Edit2,
  Link2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { isLinked, type Challenge, type ChallengeEntry } from "@/hooks/use-challenges"
import {
  challengePace,
  dateOfKey,
  dayKeyOf,
  formatAmount,
  monthKeyOf,
  plural,
  weekKeys,
  weekSum,
} from "@/lib/tracking"

export interface ChallengeActions {
  onAddEntry: (challengeId: string, value: number) => void
  onToggleDay: (challenge: Challenge, day: string) => void
  onEdit?: (challenge: Challenge) => void
  onCopy?: (challenge: Challenge) => void
  onDelete?: (challenge: Challenge) => void
  onSetCompleted?: (challenge: Challenge, isCompleted: boolean) => void
  onEditEntry?: (challenge: Challenge, entry: ChallengeEntry) => void
}

interface ChallengeCardProps extends ChallengeActions {
  challenge: Challenge
  /** The user's today (yyyy-MM-dd) */
  today: string
  /** Short form for the "Dziś" page: progress, pace and the quick action only */
  compact?: boolean
}

const WEEKDAY_LETTERS = ["P", "W", "Ś", "C", "P", "S", "N"]

function unitLabel(challenge: Challenge): string {
  if (challenge.challengeType === "WEEKLY_HABIT") return "tyg."
  if (challenge.challengeType === "MONTHLY_GOAL") return "mies."
  return challenge.unit
}

/** Where the challenge stands against an even pace to the target */
function PaceLine({ challenge, today }: { challenge: Challenge; today: string }) {
  const pace = challengePace({
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    target: challenge.targetValue,
    current: challenge.currentValue,
    today,
  })
  const unit = unitLabel(challenge)
  const days = (n: number) => `${n} ${plural(n, "dzień", "dni", "dni")}`

  if (pace.status === "done") {
    return (
      <p className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
        <Trophy className="h-3.5 w-3.5" />
        Cel osiągnięty
        {challenge.currentValue > challenge.targetValue &&
          ` · ${formatAmount(challenge.currentValue - challenge.targetValue)} ${unit} ponad`}
      </p>
    )
  }
  if (pace.status === "upcoming") {
    return <p className="text-xs text-muted-foreground">Zaczyna się {format(dateOfKey(dayKeyOf(challenge.startDate)), "d MMM", { locale: pl })}</p>
  }
  if (pace.status === "over") {
    return (
      <p className="text-xs text-muted-foreground">
        Termin minął · zabrakło {formatAmount(pace.remaining)} {unit}
      </p>
    )
  }

  const left = `zostało ${days(pace.daysLeft)}`
  // Weekly / monthly targets move in whole weeks and months - an even daily pace says little there
  if (challenge.challengeType !== "NUMERIC") {
    return <p className="text-xs text-muted-foreground">{left}</p>
  }
  const perWeek =
    pace.perWeekNeeded !== null && pace.daysLeft > 7 ? ` · potrzeba ${formatAmount(pace.perWeekNeeded)} ${unit}/tydz.` : ""
  if (pace.status === "ahead") {
    return (
      <p className="text-xs">
        <span className="font-medium text-green-600 dark:text-green-400">
          {pace.delta >= 0.05 ? `${formatAmount(pace.delta)} ${unit} przed planem` : "Zgodnie z planem"}
        </span>
        <span className="text-muted-foreground"> · {left}</span>
      </p>
    )
  }
  return (
    <p className="text-xs">
      <span className="font-medium text-amber-600 dark:text-amber-400">
        {formatAmount(Math.abs(pace.delta))} {unit} za planem
      </span>
      <span className="text-muted-foreground">
        {" "}
        · {left}
        {perWeek}
      </span>
    </p>
  )
}

/** A challenge: progress, pace against the plan and the way to add to it */
export const ChallengeCard = memo(function ChallengeCard({
  challenge,
  today,
  compact = false,
  onAddEntry,
  onToggleDay,
  onEdit,
  onCopy,
  onDelete,
  onSetCompleted,
  onEditEntry,
}: ChallengeCardProps) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState("")

  const linked = isLinked(challenge)
  const type = challenge.challengeType
  const progress = challenge.targetValue > 0 ? (challenge.currentValue / challenge.targetValue) * 100 : 0
  const reached = challenge.currentValue >= challenge.targetValue
  const hasMenu = !compact && (onEdit || onCopy || onDelete || onSetCompleted)

  const submitEntry = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(value.replace(",", "."))
    if (!Number.isFinite(amount) || amount === 0) return
    onAddEntry(challenge.id, amount)
    setValue("")
    setAdding(false)
  }

  const week = type === "WEEKLY_HABIT" ? weekKeys(today) : []
  const weekDone = type === "WEEKLY_HABIT" ? weekSum(challenge.entries, today) : 0
  const doneDays = new Set(challenge.entries.map((e) => dayKeyOf(e.date)))
  const doneMonths = new Set(challenge.entries.map((e) => monthKeyOf(dayKeyOf(e.date))))

  const months: string[] = []
  if (type === "MONTHLY_GOAL") {
    let month = monthKeyOf(dayKeyOf(challenge.startDate))
    const last = monthKeyOf(dayKeyOf(challenge.endDate))
    while (month <= last && months.length < 12) {
      months.push(month)
      const [y, m] = month.split("-").map(Number)
      month = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
    }
  }

  return (
    <Card className={cn(challenge.isCompleted && "opacity-70")}>
      <CardContent className={cn("space-y-3", compact ? "p-3" : "p-4")}>
        <div className="flex items-start gap-2">
          <span className="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: challenge.color }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-semibold leading-snug">{challenge.name}</h3>
              {type === "WEEKLY_HABIT" && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                  {challenge.weeklyTarget}× w tyg.
                </span>
              )}
              {type === "MONTHLY_GOAL" && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">1× w mies.</span>
              )}
              {challenge.isPublic && <Users className="h-3.5 w-3.5 text-muted-foreground" aria-label="Widoczne dla znajomych" />}
            </div>
            {linked && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3" />
                Liczy się samo: {challenge.linkedLabel}
              </p>
            )}
            {!compact && challenge.description && (
              <p className="mt-1 text-sm text-muted-foreground">{challenge.description}</p>
            )}
          </div>
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="-mr-2 -mt-2 h-10 w-10 flex-shrink-0" aria-label="Więcej">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem className="h-10" onClick={() => onEdit(challenge)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edytuj
                  </DropdownMenuItem>
                )}
                {onCopy && (
                  <DropdownMenuItem className="h-10" onClick={() => onCopy(challenge)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Powtórz (kopia)
                  </DropdownMenuItem>
                )}
                {onSetCompleted && (
                  <DropdownMenuItem className="h-10" onClick={() => onSetCompleted(challenge, !challenge.isCompleted)}>
                    {challenge.isCompleted ? <RotateCcw className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                    {challenge.isCompleted ? "Przywróć do aktywnych" : "Zakończ"}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem className="h-10 text-destructive" onClick={() => onDelete(challenge)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Usuń
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="text-lg font-bold tabular-nums">{formatAmount(challenge.currentValue)}</span>
              <span className="text-muted-foreground">
                {" "}
                / {formatAmount(challenge.targetValue)} {unitLabel(challenge)}
              </span>
            </span>
            <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.min(100, progress)}%`, backgroundColor: challenge.color }}
            />
          </div>
          <div className="mt-1.5">
            <PaceLine challenge={challenge} today={today} />
          </div>
        </div>

        {/* Weekly: the days of this week */}
        {type === "WEEKLY_HABIT" && !challenge.isCompleted && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Ten tydzień</span>
              <span className={cn("tabular-nums", weekDone >= (challenge.weeklyTarget ?? 1) && "font-medium text-green-600 dark:text-green-400")}>
                {formatAmount(weekDone)}/{challenge.weeklyTarget}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {week.map((day, i) => {
                const done = doneDays.has(day)
                const future = day > today
                const dayClass = cn(
                  "flex h-10 flex-col items-center justify-center rounded-lg text-[11px] font-medium transition-colors",
                  done ? "text-white" : "border border-dashed border-muted-foreground/30 text-muted-foreground",
                  day === today && !done && "border-solid border-foreground/60 text-foreground",
                  future && "opacity-40"
                )
                const content = done ? <Check className="h-4 w-4" strokeWidth={3} /> : WEEKDAY_LETTERS[i]
                // Counted from a habit / sport: the days show what is logged there
                return linked ? (
                  <div key={day} className={dayClass} style={done ? { backgroundColor: challenge.color } : undefined}>
                    {content}
                  </div>
                ) : (
                  <button
                    key={day}
                    type="button"
                    disabled={future}
                    onClick={() => onToggleDay(challenge, day)}
                    aria-pressed={done}
                    aria-label={format(dateOfKey(day), "EEEE", { locale: pl })}
                    className={cn(dayClass, !future && "active:scale-95")}
                    style={done ? { backgroundColor: challenge.color } : undefined}
                  >
                    {content}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Monthly: one tick a month */}
        {type === "MONTHLY_GOAL" && !challenge.isCompleted && (
          <div className="flex flex-wrap gap-1.5">
            {months.map((month) => {
              const done = doneMonths.has(month)
              const future = month > monthKeyOf(today)
              const monthClass = cn(
                "flex h-10 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors",
                done ? "text-white" : "border border-dashed border-muted-foreground/30 text-muted-foreground",
                month === monthKeyOf(today) && !done && "border-solid border-foreground/60 text-foreground",
                future && "opacity-40"
              )
              const label = (
                <>
                  {format(dateOfKey(`${month}-01`), "LLL", { locale: pl })}
                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </>
              )
              return linked ? (
                <div key={month} className={monthClass} style={done ? { backgroundColor: challenge.color } : undefined}>
                  {label}
                </div>
              ) : (
                <button
                  key={month}
                  type="button"
                  disabled={future}
                  onClick={() => onToggleDay(challenge, month === monthKeyOf(today) ? today : `${month}-01`)}
                  aria-pressed={done}
                  className={cn(monthClass, !future && "active:scale-95")}
                  style={done ? { backgroundColor: challenge.color } : undefined}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Numeric with own entries: add progress */}
        {type === "NUMERIC" && !linked && !challenge.isCompleted && (
          adding ? (
            <form onSubmit={submitEntry} className="flex gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Ile ${challenge.unit}?`}
                className="h-11 text-base"
                autoFocus
              />
              <Button type="submit" className="h-11 px-4" disabled={!value.trim()}>
                Dodaj
              </Button>
              <Button type="button" variant="ghost" className="h-11 px-3" onClick={() => { setAdding(false); setValue("") }}>
                Anuluj
              </Button>
            </form>
          ) : (
            <Button variant="outline" className="h-11 w-full" onClick={() => setAdding(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj postęp
            </Button>
          )
        )}

        {/* Dates and the last entries */}
        {!compact && (
          <p className="text-xs text-muted-foreground">
            {format(dateOfKey(dayKeyOf(challenge.startDate)), "d MMM", { locale: pl })} –{" "}
            {format(dateOfKey(dayKeyOf(challenge.endDate)), "d MMM yyyy", { locale: pl })}
          </p>
        )}
        {!compact && type === "NUMERIC" && challenge.entries.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Ostatnie wpisy</div>
            <ul className="divide-y rounded-lg border text-sm">
              {challenge.entries.slice(0, 5).map((entry) => {
                const row = (
                  <>
                    <span className="text-muted-foreground">{format(dateOfKey(dayKeyOf(entry.date)), "d MMM", { locale: pl })}</span>
                    <span className="font-medium tabular-nums">
                      {entry.value > 0 ? "+" : ""}
                      {formatAmount(entry.value)} {challenge.unit}
                    </span>
                  </>
                )
                return (
                  <li key={entry.id}>
                    {!linked && onEditEntry ? (
                      <button
                        type="button"
                        onClick={() => onEditEntry(challenge, entry)}
                        disabled={entry.id.startsWith("temp-")}
                        className="flex min-h-[2.5rem] w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors active:bg-accent md:hover:bg-accent/60"
                      >
                        {row}
                      </button>
                    ) : (
                      <div className="flex min-h-[2.5rem] items-center justify-between gap-2 px-3 py-1.5">{row}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {!compact && reached && !challenge.isCompleted && onSetCompleted && type === "NUMERIC" && (
          <Button variant="secondary" className="h-10 w-full" onClick={() => onSetCompleted(challenge, true)}>
            <Trophy className="mr-2 h-4 w-4" />
            Zakończ wyzwanie
          </Button>
        )}
      </CardContent>
    </Card>
  )
})
