"use client"

import { memo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Target,
  Sparkles,
  Dumbbell,
  Menu,
  CalendarDays,
  Repeat,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { SidebarContent } from "./sidebar"

const workBottomNav = [
  { href: "/backlog", label: "Backlog", icon: LayoutDashboard },
  { href: "/ai", label: "AI", icon: Sparkles },
  { href: "/schedule", label: "Plan", icon: CalendarDays },
]

const privateBottomNav = [
  { href: "/schedule", label: "Plan", icon: CalendarDays },
  { href: "/sport", label: "Sport", icon: Dumbbell },
  { href: "/habits", label: "Nawyki", icon: Repeat },
]

export function BottomNav() {
  const pathname = usePathname()
  const { workspace } = useWorkspaceStore()

  const navItems = workspace === "WORK" ? workBottomNav : privateBottomNav

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden safe-area-inset-bottom">
      <div className="flex h-full items-center justify-around px-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 flex-1 touch-manipulation",
              isActive(item.href)
                ? workspace === "WORK"
                  ? "text-work"
                  : "text-private"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-[10px] font-medium truncate w-full text-center leading-tight">
              {item.label}
            </span>
          </Link>
        ))}

        {/* Menu button */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 flex-1 touch-manipulation text-muted-foreground active:text-foreground"
              )}
            >
              <Menu className="h-5 w-5 flex-shrink-0" />
              <span className="text-[10px] font-medium truncate w-full text-center leading-tight">
                Menu
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
