"use client"

import { useState, useRef, useEffect } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  MessageCircle,
  X,
  Send,
  Loader2,
  ChevronLeft,
  Users,
  StickyNote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import { useSession } from "next-auth/react"

interface Message {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface Organization {
  id: string
  name: string
  _count: {
    members: number
  }
}

interface OrganizationsResponse {
  owned: Organization[]
  memberOf: Organization[]
}

type ViewMode = "menu" | "teams" | "chat" | "note"

export function FloatingChat() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("menu")
  const [selectedTeam, setSelectedTeam] = useState<Organization | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch user's teams
  const { data: orgsData } = useSWR<OrganizationsResponse>(
    session ? "/api/organizations" : null
  )

  // Combine owned and memberOf teams
  const teams = orgsData ? [...(orgsData.owned || []), ...(orgsData.memberOf || [])] : []

  // Fetch messages for selected team
  const { data: messages, mutate: mutateMessages } = useSWR<Message[]>(
    selectedTeam ? `/api/organizations/${selectedTeam.id}/messages` : null,
    {
      refreshInterval: isOpen && selectedTeam ? 3000 : 0,
    }
  )

  // Auto-scroll when messages change
  useEffect(() => {
    if (scrollRef.current && messages) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when team is selected
  useEffect(() => {
    if (selectedTeam && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedTeam])

  // Reset view when closing
  useEffect(() => {
    if (!isOpen) {
      setViewMode("menu")
      setSelectedTeam(null)
    }
  }, [isOpen])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending || !selectedTeam) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/organizations/${selectedTeam.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      })

      if (res.ok) {
        setNewMessage("")
        mutateMessages()
      }
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return format(date, "HH:mm")
    }
    return format(date, "d MMM, HH:mm", { locale: pl })
  }

  const handleSelectTeam = (team: Organization) => {
    setSelectedTeam(team)
    setViewMode("chat")
  }

  const handleBack = () => {
    if (viewMode === "chat") {
      setSelectedTeam(null)
      setViewMode("teams")
    } else {
      setViewMode("menu")
    }
  }

  if (!session) return null

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-20 right-4 md:bottom-6 md:right-6 h-12 w-12 md:h-14 md:w-14 rounded-full shadow-lg z-40",
            "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
          size="icon"
        >
          <Plus className="h-5 w-5 md:h-6 md:w-6" />
        </Button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-72 sm:w-80 h-[420px] bg-background border rounded-lg shadow-xl z-40 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-3 flex items-center gap-2">
            {viewMode !== "menu" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={handleBack}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">
                {viewMode === "menu" && "Szybkie akcje"}
                {viewMode === "teams" && "Czat zespołowy"}
                {viewMode === "chat" && selectedTeam?.name}
                {viewMode === "note" && "Notatka"}
              </h3>
              {viewMode === "chat" && selectedTeam && (
                <p className="text-xs opacity-80">
                  {selectedTeam._count.members} członków
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          {viewMode === "menu" && (
            <div className="flex-1 p-4 space-y-2">
              <button
                onClick={() => setViewMode("teams")}
                className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-medium">Czat zespołowy</div>
                  <div className="text-xs text-muted-foreground">
                    Napisz do swojego zespołu
                  </div>
                </div>
              </button>

              <button
                onClick={() => setViewMode("note")}
                className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <StickyNote className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="font-medium">Szybka notatka</div>
                  <div className="text-xs text-muted-foreground">
                    Zapisz coś na później
                  </div>
                </div>
              </button>
            </div>
          )}

          {viewMode === "teams" && (
            <ScrollArea className="flex-1">
              {teams.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <Users className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm text-center">
                    Nie należysz do żadnego zespołu
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => handleSelectTeam(team)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{team.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {team._count.members} członków
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          {viewMode === "chat" && selectedTeam && (
            <>
              <ScrollArea ref={scrollRef} className="flex-1 p-3">
                {!messages || messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    <p>Brak wiadomości</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isOwn = message.user.id === session?.user?.id
                      return (
                        <div
                          key={message.id}
                          className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                        >
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarImage src={message.user.image || ""} />
                            <AvatarFallback className="text-xs">
                              {message.user.name?.[0] || message.user.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`max-w-[75%] ${isOwn ? "text-right" : ""}`}>
                            {!isOwn && (
                              <span className="text-xs text-muted-foreground">
                                {message.user.name || message.user.email.split("@")[0]}
                              </span>
                            )}
                            <div
                              className={cn(
                                "inline-block rounded-lg px-3 py-1.5 text-sm",
                                isOwn
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}
                            >
                              {message.content}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatMessageDate(message.createdAt)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="border-t p-2">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Napisz wiadomość..."
                    disabled={isSending}
                    className="text-sm"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSending || !newMessage.trim()}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}

          {viewMode === "note" && (
            <div className="flex-1 p-4 flex flex-col items-center justify-center text-muted-foreground">
              <StickyNote className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm text-center">
                Funkcja notatek wkrótce dostępna
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
