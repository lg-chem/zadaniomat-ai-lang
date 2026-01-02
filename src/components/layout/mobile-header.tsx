"use client"

import { useRouter } from "next/navigation"
import { Menu, CheckSquare, Briefcase, User, Users } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { SidebarContent } from "./sidebar"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { cn } from "@/lib/utils"

export function MobileHeader() {
  const router = useRouter()
  const { workspace, setWorkspace } = useWorkspaceStore()

  const handleWorkspaceChange = (newWorkspace: "FRIENDS" | "WORK" | "PRIVATE") => {
    setWorkspace(newWorkspace)
    if (newWorkspace === "FRIENDS") {
      router.push("/dashboard")
    } else if (newWorkspace === "WORK") {
      router.push("/schedule")
    } else {
      router.push("/schedule")
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 border-b bg-card md:hidden">
      <div className="flex h-full items-center justify-between px-3 gap-2">
        {/* Hamburger Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Workspace Switcher - Mobile Compact */}
        <div className="flex items-center gap-0.5 p-1 bg-muted rounded-lg flex-1 max-w-[200px]">
          <button
            onClick={() => handleWorkspaceChange("FRIENDS")}
            className={cn(
              "flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1",
              workspace === "FRIENDS"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Zn.</span>
          </button>
          <button
            onClick={() => handleWorkspaceChange("WORK")}
            className={cn(
              "flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1",
              workspace === "WORK"
                ? "bg-work text-work-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Pr.</span>
          </button>
          <button
            onClick={() => handleWorkspaceChange("PRIVATE")}
            className={cn(
              "flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1",
              workspace === "PRIVATE"
                ? "bg-private text-private-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <User className="h-3.5 w-3.5" />
            <span>Pryw.</span>
          </button>
        </div>

        {/* Logo - Compact */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <CheckSquare className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      </div>
    </header>
  )
}
