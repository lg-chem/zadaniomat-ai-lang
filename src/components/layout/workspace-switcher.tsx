"use client"

import { useRouter } from "next/navigation"
import { Briefcase, User, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function WorkspaceSwitcher() {
  const router = useRouter()
  const { workspace, setWorkspace } = useWorkspaceStore()

  const handleWorkspaceChange = (newWorkspace: "FRIENDS" | "WORK" | "PRIVATE") => {
    setWorkspace(newWorkspace)
    // Navigate to default page for each workspace
    if (newWorkspace === "FRIENDS") {
      router.push("/dashboard")
    } else if (newWorkspace === "WORK") {
      router.push("/schedule")
    } else {
      router.push("/schedule")
    }
  }

  return (
    <div className="flex items-center gap-0.5 p-1 bg-muted rounded-lg w-full">
      <button
        onClick={() => handleWorkspaceChange("FRIENDS")}
        className={cn(
          "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1 min-w-0",
          workspace === "FRIENDS"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Users className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Znajomi</span>
      </button>
      <button
        onClick={() => handleWorkspaceChange("WORK")}
        className={cn(
          "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1 min-w-0",
          workspace === "WORK"
            ? "bg-work text-work-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Praca</span>
      </button>
      <button
        onClick={() => handleWorkspaceChange("PRIVATE")}
        className={cn(
          "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1 min-w-0",
          workspace === "PRIVATE"
            ? "bg-private text-private-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <User className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Prywatne</span>
      </button>
    </div>
  )
}
