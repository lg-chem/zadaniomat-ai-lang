"use client"

import { useState, useRef, useEffect } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ChevronLeft,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
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

export function FloatingChat() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Organization | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch user's teams
  const { data: teams } = useSWR<Organization[]>(
    session ? "/api/organizations" : null
  )

  // Fetch messages for selected team
  const { data: messages, mutate: mutateMessages } = useSWR<Message[]>(
    selectedTeam ? `/api/organizations/${selectedTeam.id}/messages` : null,
    {
      refreshInterval: isOpen && selectedTeam ? 3000 : 0, // Poll only when open
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

  if (!session) return null

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          isOpen && "rotate-90"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 h-[500px] bg-background border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-3 flex items-center gap-2">
            {selectedTeam ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setSelectedTeam(null)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{selectedTeam.name}</h3>
                  <p className="text-xs opacity-80">
                    {selectedTeam._count.members} członków
                  </p>
                </div>
              </>
            ) : (
              <>
                <MessageCircle className="h-5 w-5" />
                <h3 className="font-semibold">Czat zespołowy</h3>
              </>
            )}
          </div>

          {/* Content */}
          {selectedTeam ? (
            // Messages View
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

              {/* Input */}
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
          ) : (
            // Teams List View
            <ScrollArea className="flex-1">
              {!teams || teams.length === 0 ? (
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
                      onClick={() => setSelectedTeam(team)}
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
        </div>
      )}
    </>
  )
}
