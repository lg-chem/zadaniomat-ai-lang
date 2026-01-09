"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Briefcase, User, Users, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function WorkspaceSwitcher() {
  const router = useRouter()
  const { workspace, setWorkspace } = useWorkspaceStore()
  const [isPending, startTransition] = useTransition()

  // Fetch user restrictions
  const { data: restrictions, isLoading } = useSWR<{ restrictedToWork: boolean }>(
    "/api/user/restrictions",
    fetcher
  )

  const isRestricted = restrictions?.restrictedToWork ?? false

  // If user is restricted and not in WORK workspace, force them to WORK
  useEffect(() => {
    if (isRestricted && workspace !== "WORK") {
      setWorkspace("WORK")
      router.push("/schedule")
    }
  }, [isRestricted, workspace, setWorkspace, router])

  const handleWorkspaceChange = (newWorkspace: "FRIENDS" | "WORK" | "PRIVATE") => {
    // Prevent switching to restricted workspaces
    if (isRestricted && newWorkspace !== "WORK") {
      return
    }

    setWorkspace(newWorkspace)
    // Navigate to default page for each workspace with transition
    startTransition(() => {
      router.push("/schedule")
    })
  }

  // Get the icon for a workspace, showing spinner if pending
  const getIcon = (ws: "FRIENDS" | "WORK" | "PRIVATE") => {
    if (isPending && workspace === ws) {
      return <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
    }
    switch (ws) {
      case "FRIENDS":
        return <Users className="h-3.5 w-3.5 flex-shrink-0" />
      case "WORK":
        return <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
      case "PRIVATE":
        return <User className="h-3.5 w-3.5 flex-shrink-0" />
    }
  }

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="flex items-center gap-0.5 p-1 bg-muted rounded-lg w-full">
        <div className="flex-1 h-8 rounded-md bg-muted-foreground/10 animate-pulse" />
        <div className="flex-1 h-8 rounded-md bg-muted-foreground/10 animate-pulse" />
        <div className="flex-1 h-8 rounded-md bg-muted-foreground/10 animate-pulse" />
      </div>
    )
  }

  // If user is restricted, only show WORK button
  if (isRestricted) {
    return (
      <div className="flex items-center gap-0.5 p-1 bg-muted rounded-lg w-full">
        <button
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1 min-w-0 bg-work text-work-foreground shadow-sm"
        >
          <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">Praca</span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5 p-1 bg-muted rounded-lg w-full">
      <button
        onClick={() => handleWorkspaceChange("FRIENDS")}
        disabled={isPending}
        className={cn(
          "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1 min-w-0",
          workspace === "FRIENDS"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          isPending && workspace === "FRIENDS" && "opacity-70"
        )}
      >
        {getIcon("FRIENDS")}
        <span className="truncate">Znajomi</span>
      </button>
      <button
        onClick={() => handleWorkspaceChange("WORK")}
        disabled={isPending}
        className={cn(
          "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1 min-w-0",
          workspace === "WORK"
            ? "bg-work text-work-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          isPending && workspace === "WORK" && "opacity-70"
        )}
      >
        {getIcon("WORK")}
        <span className="truncate">Praca</span>
      </button>
      <button
        onClick={() => handleWorkspaceChange("PRIVATE")}
        disabled={isPending}
        className={cn(
          "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1 min-w-0",
          workspace === "PRIVATE"
            ? "bg-private text-private-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          isPending && workspace === "PRIVATE" && "opacity-70"
        )}
      >
        {getIcon("PRIVATE")}
        <span className="truncate">Prywatne</span>
      </button>
    </div>
  )
}
