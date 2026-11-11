"use client"

import { useState } from "react"
import useSWR from "swr"
import { EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { jsonRequest } from "@/lib/pending-writes"
import { refreshPrivate } from "@/lib/private-sync"
import { plural } from "@/lib/tracking"

interface PublicCounts {
  habits: number
  challenges: number
  sportActivities: number
  steps: number
  total: number
}

/**
 * Shown while some of the user's habits, workouts, challenges or steps are visible
 * to other people ("Znajomi") - entries used to be public unless switched off.
 * One tap hides them all.
 */
export function PrivacyBanner() {
  const { data, mutate } = useSWR<PublicCounts>("/api/user/privacy", { revalidateOnFocus: false })
  const [hiding, setHiding] = useState(false)

  if (!data || data.total === 0) return null

  const parts = [
    data.habits && `${data.habits} ${plural(data.habits, "nawyk", "nawyki", "nawyków")}`,
    data.sportActivities && `${data.sportActivities} ${plural(data.sportActivities, "trening", "treningi", "treningów")}`,
    data.challenges && `${data.challenges} ${plural(data.challenges, "wyzwanie", "wyzwania", "wyzwań")}`,
    data.steps && `${data.steps} ${plural(data.steps, "dzień", "dni", "dni")} z krokami`,
  ].filter(Boolean)

  const hideAll = async () => {
    setHiding(true)
    try {
      await jsonRequest("/api/user/privacy", "POST")
      await mutate({ habits: 0, challenges: 0, sportActivities: 0, steps: 0, total: 0 }, { revalidate: false })
      refreshPrivate("habits", "sport", "steps")
      toast.success("Wszystkie wpisy są teraz tylko dla Ciebie")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się ukryć wpisów")
    } finally {
      setHiding(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-medium">Część Twoich wpisów widzą inni użytkownicy</p>
        <p className="text-muted-foreground">
          W zakładce Znajomi widać: {parts.join(", ")}. Nowe wpisy są już domyślnie prywatne.
        </p>
      </div>
      <Button className="h-11 flex-shrink-0" onClick={hideAll} disabled={hiding}>
        <EyeOff className="mr-2 h-4 w-4" />
        Ukryj wszystkie
      </Button>
    </div>
  )
}
