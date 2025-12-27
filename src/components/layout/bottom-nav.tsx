"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Target,
  Calendar,
  Sparkles,
  Settings,
  Dumbbell,
  CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"

const workBottomNav = [
  { href: "/", label: "Dziś", icon: LayoutDashboard },
  { href: "/tasks", label: "Zadania", icon: CheckSquare },
  { href: "/goals", label: "Cele", icon: Target },
  { href: "/ai", label: "AI", icon: Sparkles },
  { href: "/settings", label: "Więcej", icon: Settings },
]

const privateBottomNav = [
  { href: "/", label: "Dziś", icon: LayoutDashboard },
  { href: "/sport", label: "Sport", icon: Dumbbell },
  { href: "/goals", label: "Cele", icon: Target },
  { href: "/ai", label: "AI", icon: Sparkles },
  { href: "/settings", label: "Więcej", icon: Settings },
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t bg-card md:hidden">
      <div className="flex h-full items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-0 flex-1",
              isActive(item.href)
                ? workspace === "WORK"
                  ? "text-work"
                  : "text-private"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-xs font-medium truncate w-full text-center">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
