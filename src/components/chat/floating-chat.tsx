"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  Bug,
  Lightbulb,
  Check,
  AlertCircle,
  ClipboardList,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { useBacklog } from "@/hooks/use-backlog"
import { useWorkspaceStore } from "@/stores/workspace-store"

// localStorage key for tracking last read timestamps
const CHAT_LAST_READ_KEY = "chat_last_read_timestamps"

interface UnreadResponse {
  totalUnread: number
  unreadCounts: Record<string, number>
  organizations: Array<{
    id: string
    name: string
    unreadCount: number
  }>
}

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

interface TeamMember {
  id: string
  role: string
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
  members?: TeamMember[]
}

interface OrganizationsResponse {
  owned: Organization[]
  memberOf: Organization[]
}

interface Category {
  id: string
  name: string
  color: string
}

type ViewMode = "menu" | "teams" | "chat" | "note" | "assign-teams" | "assign-members" | "assign-task"
type NoteMode = "backlog" | "admin"
type ReportType = "BUG" | "FEATURE" | "OTHER"
type FeedbackType = "success" | "error" | null

// Helper functions for localStorage
const getLastReadTimestamps = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  try {
    const stored = localStorage.getItem(CHAT_LAST_READ_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

const setLastReadTimestamp = (orgId: string) => {
  if (typeof window === "undefined") return
  try {
    const timestamps = getLastReadTimestamps()
    timestamps[orgId] = new Date().toISOString()
    localStorage.setItem(CHAT_LAST_READ_KEY, JSON.stringify(timestamps))
  } catch {
    // Ignore localStorage errors
  }
}

// Custom fetcher for unread counts that sends POST with timestamps
const fetchUnreadCounts = async (): Promise<UnreadResponse> => {
  const timestamps = getLastReadTimestamps()
  const res = await fetch("/api/chat/unread", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lastReadTimestamps: timestamps }),
  })
  if (!res.ok) throw new Error("Failed to fetch unread counts")
  return res.json()
}

export function FloatingChat() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("menu")
  const [selectedTeam, setSelectedTeam] = useState<Organization | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Note/backlog state
  const [noteMode, setNoteMode] = useState<NoteMode>("backlog")
  const [noteContent, setNoteContent] = useState("")
  const [reportType, setReportType] = useState<ReportType>("BUG")
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string } | null>(null)
  const noteInputRef = useRef<HTMLInputElement>(null)
  const { workspace } = useWorkspaceStore()
  const { mutate: mutateBacklog } = useBacklog()

  // Assign task state
  const [assignTeam, setAssignTeam] = useState<Organization | null>(null)
  const [assignMember, setAssignMember] = useState<TeamMember | null>(null)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskCategoryId, setTaskCategoryId] = useState<string>("")
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const taskInputRef = useRef<HTMLInputElement>(null)

  // Fetch user's teams
  const { data: orgsData } = useSWR<OrganizationsResponse>(
    session ? "/api/organizations" : null
  )

  // Fetch unread message counts
  const { data: unreadData, mutate: mutateUnread } = useSWR<UnreadResponse>(
    session ? "chat-unread" : null,
    fetchUnreadCounts,
    { refreshInterval: 10000 } // Check every 10 seconds
  )

  const totalUnread = unreadData?.totalUnread || 0

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
      setNoteContent("")
      setNoteMode("backlog")
      setReportType("BUG")
      setAssignTeam(null)
      setAssignMember(null)
      setTaskTitle("")
      setTaskCategoryId("")
    }
  }, [isOpen])

  // Focus task input when in assign-task mode
  useEffect(() => {
    if (viewMode === "assign-task" && taskInputRef.current) {
      taskInputRef.current.focus()
    }
  }, [viewMode])

  // Focus note input when entering note mode
  useEffect(() => {
    if (viewMode === "note" && noteInputRef.current) {
      noteInputRef.current.focus()
    }
  }, [viewMode])

  // Fetch team details with members
  const { data: teamDetails } = useSWR<Organization & { members: TeamMember[] }>(
    assignTeam ? `/api/organizations/${assignTeam.id}` : null
  )

  // Fetch categories for the team (user's WORK categories)
  const { data: categories = [] } = useSWR<Category[]>(
    assignTeam ? "/api/categories?workspace=WORK" : null
  )

  const showFeedback = (type: FeedbackType, message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleSubmitTask = async () => {
    if (!taskTitle.trim() || !assignTeam || !assignMember || isSubmittingTask) return

    setIsSubmittingTask(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          workspaceType: "WORK",
          assignedToId: assignMember.user.id,
          organizationId: assignTeam.id,
          categoryId: taskCategoryId || undefined,
        }),
      })

      if (res.ok) {
        showFeedback("success", "Zadanie przydzielone!")
        setTaskTitle("")
        setTaskCategoryId("")
        setAssignMember(null)
        setViewMode("assign-members")
      } else {
        throw new Error("Failed to create task")
      }
    } catch (error) {
      console.error("Error creating task:", error)
      showFeedback("error", "Wystąpił błąd")
    } finally {
      setIsSubmittingTask(false)
    }
  }

  const handleSubmitNote = async () => {
    if (!noteContent.trim() || isSubmittingNote) return

    setIsSubmittingNote(true)
    try {
      if (noteMode === "backlog") {
        const res = await fetch("/api/backlog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: noteContent,
            workspaceType: workspace,
          }),
        })
        if (res.ok) {
          mutateBacklog()
          showFeedback("success", "Dodano do backlogu")
        }
      } else {
        const res = await fetch("/api/admin/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: noteContent,
            type: reportType,
          }),
        })
        if (res.ok) {
          showFeedback("success", "Zgłoszenie wysłane!")
        } else {
          throw new Error("Failed to send report")
        }
      }
      setNoteContent("")
    } catch (error) {
      console.error("Error:", error)
      showFeedback("error", "Wystąpił błąd")
    } finally {
      setIsSubmittingNote(false)
    }
  }

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
    // Mark messages as read for this team
    setLastReadTimestamp(team.id)
    // Refresh unread counts after a short delay
    setTimeout(() => mutateUnread(), 500)
  }

  // Open chat directly - auto-select team if only one, or go to team with most unread
  const handleOpenChat = () => {
    setIsOpen(true)

    if (teams.length === 1) {
      // Auto-select if only one team
      handleSelectTeam(teams[0])
    } else if (teams.length > 1 && unreadData?.organizations) {
      // Find team with most unread messages
      const teamWithMostUnread = unreadData.organizations
        .filter(org => org.unreadCount > 0)
        .sort((a, b) => b.unreadCount - a.unreadCount)[0]

      if (teamWithMostUnread) {
        const team = teams.find(t => t.id === teamWithMostUnread.id)
        if (team) {
          handleSelectTeam(team)
          return
        }
      }
      // Otherwise show team list
      setViewMode("teams")
    } else {
      setViewMode("teams")
    }
  }

  const handleBack = () => {
    if (viewMode === "chat") {
      setSelectedTeam(null)
      setViewMode("teams")
    } else if (viewMode === "assign-task") {
      setAssignMember(null)
      setTaskTitle("")
      setViewMode("assign-members")
    } else if (viewMode === "assign-members") {
      setAssignTeam(null)
      setViewMode("assign-teams")
    } else if (viewMode === "assign-teams") {
      setViewMode("menu")
    } else {
      setViewMode("menu")
    }
  }

  if (!session) return null

  return (
    <>
      {/* Floating Buttons */}
      {!isOpen && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex flex-col gap-3">
          {/* Chat Button with unread badge */}
          <Button
            onClick={handleOpenChat}
            className={cn(
              "relative h-12 w-12 md:h-14 md:w-14 rounded-full shadow-lg",
              totalUnread > 0
                ? "bg-blue-500 hover:bg-blue-600 animate-pulse"
                : "bg-blue-500 hover:bg-blue-600",
              "text-white"
            )}
            size="icon"
          >
            <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-red-500 text-[10px] md:text-xs font-bold text-white ring-2 ring-background">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </Button>

          {/* Quick Actions Button */}
          <Button
            onClick={() => setIsOpen(true)}
            className={cn(
              "h-12 w-12 md:h-14 md:w-14 rounded-full shadow-lg",
              "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
            size="icon"
          >
            <Plus className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        </div>
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
                {viewMode === "assign-teams" && "Przydziel zadanie"}
                {viewMode === "assign-members" && assignTeam?.name}
                {viewMode === "assign-task" && "Nowe zadanie"}
              </h3>
              {viewMode === "chat" && selectedTeam && (
                <p className="text-xs opacity-80">
                  {selectedTeam._count.members} członków
                </p>
              )}
              {viewMode === "assign-members" && (
                <p className="text-xs opacity-80">Wybierz osobę</p>
              )}
              {viewMode === "assign-task" && assignMember && (
                <p className="text-xs opacity-80">
                  dla {assignMember.user.name || assignMember.user.email.split("@")[0]}
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
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-lg border transition-colors text-left",
                  totalUnread > 0
                    ? "bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:hover:bg-blue-900/30"
                    : "hover:bg-muted"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  totalUnread > 0
                    ? "bg-blue-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900/30"
                )}>
                  <MessageCircle className={cn(
                    "h-5 w-5",
                    totalUnread > 0 ? "text-white" : "text-blue-600 dark:text-blue-400"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    Czat zespołowy
                    {totalUnread > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {totalUnread > 9 ? "9+" : totalUnread}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {totalUnread > 0 ? `${totalUnread} nowych wiadomości` : "Napisz do swojego zespołu"}
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

              <button
                onClick={() => setViewMode("assign-teams")}
                className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-medium">Przydziel zadanie</div>
                  <div className="text-xs text-muted-foreground">
                    Dodaj zadanie członkowi zespołu
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
                  {teams.map((team) => {
                    const teamUnread = unreadData?.unreadCounts?.[team.id] || 0
                    return (
                      <button
                        key={team.id}
                        onClick={() => handleSelectTeam(team)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                          teamUnread > 0
                            ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center",
                          teamUnread > 0
                            ? "bg-blue-500 text-white"
                            : "bg-primary/10"
                        )}>
                          <Users className={cn(
                            "h-5 w-5",
                            teamUnread > 0 ? "text-white" : "text-primary"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate flex items-center gap-2">
                            {team.name}
                            {teamUnread > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                                {teamUnread > 9 ? "9+" : teamUnread}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {team._count.members} członków
                          </div>
                        </div>
                      </button>
                    )
                  })}
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
            <div className="flex-1 p-4 flex flex-col">
              {/* Mode Toggle */}
              <div className="flex gap-1 p-1 bg-muted rounded-md mb-3">
                <button
                  type="button"
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    noteMode === "backlog"
                      ? "bg-background shadow-sm text-yellow-600"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setNoteMode("backlog")}
                >
                  <StickyNote className="h-3 w-3" />
                  Backlog
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    noteMode === "admin"
                      ? "bg-background shadow-sm text-blue-600"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setNoteMode("admin")}
                >
                  <Send className="h-3 w-3" />
                  Zgłoś do admina
                </button>
              </div>

              {noteMode === "backlog" ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <StickyNote className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Szybka notatka</span>
                  </div>
                  <Input
                    ref={noteInputRef}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitNote()
                    }}
                    placeholder="Wpisz pomysł..."
                    className="mb-2"
                    disabled={isSubmittingNote}
                  />
                </>
              ) : (
                <>
                  {/* Report Type Selection */}
                  <div className="flex gap-1 mb-2">
                    <button
                      type="button"
                      className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 border ${
                        reportType === "BUG"
                          ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800"
                          : "border-transparent hover:bg-muted"
                      }`}
                      onClick={() => setReportType("BUG")}
                    >
                      <Bug className="h-3 w-3" />
                      Błąd
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 border ${
                        reportType === "FEATURE"
                          ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800"
                          : "border-transparent hover:bg-muted"
                      }`}
                      onClick={() => setReportType("FEATURE")}
                    >
                      <Lightbulb className="h-3 w-3" />
                      Pomysł
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 border ${
                        reportType === "OTHER"
                          ? "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700"
                          : "border-transparent hover:bg-muted"
                      }`}
                      onClick={() => setReportType("OTHER")}
                    >
                      Inne
                    </button>
                  </div>
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder={
                      reportType === "BUG"
                        ? "Opisz błąd..."
                        : reportType === "FEATURE"
                        ? "Opisz pomysł na ficzer..."
                        : "Wpisz treść zgłoszenia..."
                    }
                    className="mb-2 min-h-[80px] text-sm flex-1"
                    disabled={isSubmittingNote}
                  />
                </>
              )}

              <Button
                className={`w-full ${noteMode === "admin" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                onClick={handleSubmitNote}
                disabled={!noteContent.trim() || isSubmittingNote}
              >
                {noteMode === "backlog" ? (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    {isSubmittingNote ? "Dodaję..." : "Dodaj"}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    {isSubmittingNote ? "Wysyłam..." : "Wyślij"}
                  </>
                )}
              </Button>

              {/* Feedback notification */}
              {feedback && (
                <div
                  className={`mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    feedback.type === "success"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {feedback.message}
                </div>
              )}
            </div>
          )}

          {/* Assign Task - Team Selection */}
          {viewMode === "assign-teams" && (
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
                      onClick={() => {
                        setAssignTeam(team)
                        setViewMode("assign-members")
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
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

          {/* Assign Task - Member Selection */}
          {viewMode === "assign-members" && assignTeam && (
            <ScrollArea className="flex-1">
              {!teamDetails?.members || teamDetails.members.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p className="text-sm">Ładowanie członków...</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {teamDetails.members
                    .filter((m) => m.user.id !== session?.user?.id) // Don't show current user
                    .map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          setAssignMember(member)
                          setViewMode("assign-task")
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.user.image || ""} />
                          <AvatarFallback>
                            {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {member.user.name || member.user.email.split("@")[0]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.role === "OWNER" ? "Właściciel" : "Członek"}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </ScrollArea>
          )}

          {/* Assign Task - Task Form */}
          {viewMode === "assign-task" && assignMember && (
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={assignMember.user.image || ""} />
                  <AvatarFallback>
                    {assignMember.user.name?.[0] || assignMember.user.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {assignMember.user.name || assignMember.user.email.split("@")[0]}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Zadanie trafi do stosu zadań
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <Input
                  ref={taskInputRef}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) handleSubmitTask()
                  }}
                  placeholder="Co ma być zrobione?"
                  disabled={isSubmittingTask}
                />

                {/* Category selector */}
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTaskCategoryId("")}
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium transition-colors",
                        !taskCategoryId
                          ? "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      Brak
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setTaskCategoryId(cat.id)}
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1",
                          taskCategoryId === cat.id
                            ? "ring-2 ring-offset-1 ring-primary"
                            : "opacity-70 hover:opacity-100"
                        )}
                        style={{
                          backgroundColor: `${cat.color}20`,
                          color: cat.color,
                        }}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleSubmitTask}
                disabled={!taskTitle.trim() || isSubmittingTask}
              >
                <ClipboardList className="h-4 w-4 mr-1" />
                {isSubmittingTask ? "Przydzielam..." : "Przydziel zadanie"}
              </Button>

              {/* Feedback notification */}
              {feedback && (
                <div
                  className={`mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    feedback.type === "success"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {feedback.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
