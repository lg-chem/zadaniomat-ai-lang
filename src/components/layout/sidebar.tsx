"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Timer,
  Inbox,
  Sparkles,
  Trophy,
  Repeat,
  Repeat2,
  Flame,
  CalendarDays,
  Dumbbell,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { WorkspaceSwitcher } from "./workspace-switcher"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const workNavItems = [
  { href: "/backlog", label: "Backlog", icon: Inbox },
  { href: "/ai", label: "AI Asystent", icon: Sparkles },
  { href: "/schedule", label: "Harmonogram", icon: CalendarDays },
  { href: "/calendar", label: "Kalendarz", icon: Calendar },
  { href: "/goals", label: "Cele", icon: Target },
  { href: "/sprints", label: "Sprinty", icon: Timer },
  { href: "/recurring", label: "Cykliczne", icon: Repeat2 },
  { href: "/stats", label: "Statystyki", icon: BarChart3 },
]

const privateNavItems = [
  { href: "/schedule", label: "Harmonogram", icon: CalendarDays },
  { href: "/habits", label: "Nawyki", icon: Repeat },
  { href: "/challenges", label: "Wyzwania", icon: Flame },
  { href: "/sport", label: "Sport", icon: Dumbbell },
  { href: "/stats", label: "Statystyki", icon: BarChart3 },
]

const bottomNavItems = [
  { href: "/gamification", label: "Osiągnięcia", icon: Trophy },
  { href: "/settings", label: "Ustawienia", icon: Settings },
]

// Sidebar content component that can be used in both desktop sidebar and mobile sheet
export function SidebarContent() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { workspace } = useWorkspaceStore()

  const navItems = workspace === "WORK" ? workNavItems : privateNavItems

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <CheckSquare className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold">Zadaniomat</span>
      </div>

      {/* Workspace Switcher */}
      <div className="p-4">
        <WorkspaceSwitcher />
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? workspace === "WORK"
                  ? "bg-work/10 text-work"
                  : "bg-private/10 text-private"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* Bottom Navigation */}
      <nav className="space-y-1 p-4">
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* User */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={session?.user?.image || ""} />
            <AvatarFallback>
              {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {session?.user?.name || "Użytkownik"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {session?.user?.email}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            title="Wyloguj"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Desktop sidebar - hidden on mobile
export function Sidebar() {
  return (
    <aside className="hidden md:fixed md:left-0 md:top-0 md:z-40 md:h-screen md:w-64 md:border-r md:bg-card md:block">
      <SidebarContent />
    </aside>
  )
}
