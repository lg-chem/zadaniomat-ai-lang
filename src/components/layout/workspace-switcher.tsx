"use client"

import { Briefcase, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function WorkspaceSwitcher() {
  const { workspace, setWorkspace } = useWorkspaceStore()

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <button
        onClick={() => setWorkspace("WORK")}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
          workspace === "WORK"
            ? "bg-work text-work-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Briefcase className="h-4 w-4" />
        <span>Praca</span>
      </button>
      <button
        onClick={() => setWorkspace("PRIVATE")}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
          workspace === "PRIVATE"
            ? "bg-private text-private-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <User className="h-4 w-4" />
        <span>Prywatne</span>
      </button>
    </div>
  )
}
