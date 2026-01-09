"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  LayoutDashboard,
  Sparkles,
  Dumbbell,
  Menu,
  CalendarDays,
  Repeat,
  Users,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useRecentFriendsStore } from "@/stores/recent-friends-store"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarContent } from "./sidebar"

// Mobile NavLink with instant feedback
interface MobileNavLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  activeClassName?: string
  isActive?: boolean
  icon?: React.ComponentType<{ className?: string }>
}

function MobileNavLink({
  href,
  children,
  className,
  activeClassName,
  isActive,
  icon: Icon,
}: MobileNavLinkProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={handleClick}
      className={cn(
        className,
        (isActive || isPending) && activeClassName,
        isPending && "opacity-70"
      )}
    >
      {Icon && (
        isPending ? (
          <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
        ) : (
          <Icon className="h-5 w-5 flex-shrink-0" />
        )
      )}
      {children}
    </Link>
  )
}

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
  const { recentFriends } = useRecentFriendsStore()

  const navItems = workspace === "WORK" ? workBottomNav : privateBottomNav

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  // Friends workspace - show recent friends
  if (workspace === "FRIENDS") {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden safe-area-inset-bottom">
        <div className="flex h-full items-center justify-around px-1">
          {/* All Friends link */}
          <MobileNavLink
            href="/dashboard"
            isActive={pathname === "/dashboard"}
            icon={Users}
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 flex-1 touch-manipulation text-muted-foreground active:text-foreground"
            activeClassName="text-primary"
          >
            <span className="text-[10px] font-medium truncate w-full text-center leading-tight">
              Wszyscy
            </span>
          </MobileNavLink>

          {/* Recent friends */}
          {recentFriends.slice(0, 2).map((friend) => (
            <MobileNavLink
              key={friend.id}
              href={`/friends?user=${friend.id}`}
              isActive={pathname.includes(friend.id)}
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 flex-1 touch-manipulation text-muted-foreground active:text-foreground"
              activeClassName="text-primary"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={friend.image || ""} />
                <AvatarFallback className="text-[8px]">
                  {friend.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] font-medium truncate w-full text-center leading-tight">
                {friend.name?.split(" ")[0] || "Znajomy"}
              </span>
            </MobileNavLink>
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden safe-area-inset-bottom">
      <div className="flex h-full items-center justify-around px-1">
        {navItems.map((item) => (
          <MobileNavLink
            key={item.href}
            href={item.href}
            isActive={isActive(item.href)}
            icon={item.icon}
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 flex-1 touch-manipulation text-muted-foreground active:text-foreground"
            activeClassName={workspace === "WORK" ? "text-work" : "text-private"}
          >
            <span className="text-[10px] font-medium truncate w-full text-center leading-tight">
              {item.label}
            </span>
          </MobileNavLink>
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
