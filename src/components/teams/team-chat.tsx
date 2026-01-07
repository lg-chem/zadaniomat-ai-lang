"use client"

import { useState, useRef, useEffect } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
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

interface TeamChatProps {
  organizationId: string
}

export function TeamChat({ organizationId }: TeamChatProps) {
  const { data: session } = useSession()
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: messages, mutate } = useSWR<Message[]>(
    `/api/organizations/${organizationId}/messages`,
    {
      refreshInterval: 5000, // Poll every 5 seconds
    }
  )

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/organizations/${organizationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      })

      if (res.ok) {
        setNewMessage("")
        mutate()
        inputRef.current?.focus()
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

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {!messages || messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Brak wiadomości. Rozpocznij rozmowę!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwn = message.user.id === session?.user?.id
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={message.user.image || ""} />
                    <AvatarFallback className="text-xs">
                      {message.user.name?.[0] || message.user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {!isOwn && (
                        <span className="text-xs font-medium">
                          {message.user.name || message.user.email}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatMessageDate(message.createdAt)}
                      </span>
                    </div>
                    <div
                      className={`inline-block rounded-lg px-3 py-2 text-sm ${
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <form onSubmit={handleSendMessage} className="border-t p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Napisz wiadomość..."
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || !newMessage.trim()}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
