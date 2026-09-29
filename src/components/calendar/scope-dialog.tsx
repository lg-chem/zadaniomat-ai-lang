"use client"

import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EditScope } from "@/hooks/use-calendar-events"
import { cn } from "@/lib/utils"

type PromptMode = "edit" | "delete" | "delete-single"

interface PromptState {
  mode: PromptMode
  allowThis: boolean
  title?: string
}

const OPTIONS: { value: EditScope; label: string }[] = [
  { value: "this", label: "To wydarzenie" },
  { value: "following", label: "To i następne wydarzenia" },
  { value: "all", label: "Wszystkie wydarzenia" },
]

// Google-style question for recurring events: which occurrences should change?
export function useScopePrompt() {
  const [state, setState] = useState<PromptState | null>(null)
  const [choice, setChoice] = useState<EditScope>("this")
  const resolveRef = useRef<((scope: EditScope | null) => void) | null>(null)

  const open = useCallback((next: PromptState) => {
    return new Promise<EditScope | null>((resolve) => {
      resolveRef.current?.(null)
      resolveRef.current = resolve
      setChoice(next.allowThis ? "this" : "following")
      setState(next)
    })
  }, [])

  const askScope = useCallback(
    (mode: "edit" | "delete", options: { allowThis?: boolean } = {}) =>
      open({ mode, allowThis: options.allowThis ?? true }),
    [open]
  )

  const confirmDelete = useCallback(
    async (title?: string) => (await open({ mode: "delete-single", allowThis: true, title })) !== null,
    [open]
  )

  const close = (value: EditScope | null) => {
    resolveRef.current?.(value)
    resolveRef.current = null
    setState(null)
  }

  const isDelete = state?.mode !== "edit"

  const element = (
    <Dialog open={!!state} onOpenChange={(isOpen) => !isOpen && close(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === "delete-single"
              ? "Usunąć wydarzenie?"
              : state?.mode === "delete"
                ? "Usuń wydarzenie cykliczne"
                : "Edytuj wydarzenie cykliczne"}
          </DialogTitle>
          {state?.mode === "delete-single" && state.title ? (
            <DialogDescription>„{state.title}” zniknie z kalendarza.</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Wybierz, których wystąpień dotyczy zmiana</DialogDescription>
          )}
        </DialogHeader>

        {state && state.mode !== "delete-single" && (
          <div className="space-y-1" role="radiogroup">
            {OPTIONS.filter((o) => state.allowThis || o.value !== "this").map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted",
                  choice === option.value && "bg-muted"
                )}
              >
                <input
                  type="radio"
                  name="event-scope"
                  className="h-4 w-4 accent-primary"
                  checked={choice === option.value}
                  onChange={() => setChoice(option.value)}
                />
                {option.label}
              </label>
            ))}
            {!state.allowThis && (
              <p className="px-3 pt-1 text-xs text-muted-foreground">
                Zmiana powtarzania dotyczy całej serii albo jej dalszej części.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => close(null)}>
            Anuluj
          </Button>
          <Button variant={isDelete ? "destructive" : "default"} onClick={() => close(choice)}>
            {isDelete ? "Usuń" : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { askScope, confirmDelete, element }
}
