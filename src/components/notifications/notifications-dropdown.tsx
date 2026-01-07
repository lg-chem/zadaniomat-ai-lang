"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Bell,
  Check,
  CheckCheck,
  ClipboardList,
  Trash2,
  UserPlus,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import useSWR from "swr"

interface Notification {
  id: string
  type: "TASK_DELETED" | "TASK_COMPLETED" | "TASK_ASSIGNED" | "MEMBER_JOINED"
  title: string
  message: string
  isRead: boolean
  createdAt: string
  metadata?: Record<string, unknown>
}

interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "TASK_ASSIGNED":
      return <ClipboardList className="h-4 w-4 text-blue-500" />
    case "TASK_COMPLETED":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "TASK_DELETED":
      return <Trash2 className="h-4 w-4 text-red-500" />
    case "MEMBER_JOINED":
      return <UserPlus className="h-4 w-4 text-purple-500" />
    default:
      return <Bell className="h-4 w-4" />
  }
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false)

  const { data, mutate } = useSWR<NotificationsResponse>(
    "/api/notifications?limit=20",
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  )

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const handleMarkAsRead = async (notificationIds: string[]) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      })
      mutate()
    } catch (error) {
      console.error("Error marking notifications as read:", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      })
      mutate()
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: "DELETE",
      })
      mutate()
    } catch (error) {
      console.error("Error deleting notification:", error)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Powiadomienia</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Oznacz wszystkie
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Brak powiadomień</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-accent/50 transition-colors",
                    !notification.isRead && "bg-primary/5"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMarkAsRead([notification.id])}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(notification.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: pl,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
