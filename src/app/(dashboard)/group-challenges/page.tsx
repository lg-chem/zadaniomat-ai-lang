"use client"

import { useState, useEffect, KeyboardEvent, useRef } from "react"
import {
  format,
  differenceInDays,
  startOfWeek,
  addDays,
  startOfMonth,
  isSameDay,
  getMonth,
} from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  Check,
  Trash2,
  X,
  Trophy,
  Calendar,
  TrendingUp,
  Edit2,
  MoreHorizontal,
  Users,
  UserPlus,
  Mail,
  Crown,
  LogOut,
  Bell,
  Settings,
  RefreshCw,
  Footprints,
  Dumbbell,
  Target,
  Link2Off,
  MessageCircle,
  Send,
  BarChart3,
  Flame,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useSWR from "swr"
import {
  useGroupChallenges,
  useGroupChallengeInvitations,
  type GroupChallenge,
  type LinkedDataType,
  type MemberIntegrationSettings,
} from "@/hooks/use-group-challenges"

type ChallengeType = "NUMERIC" | "WEEKLY_HABIT" | "MONTHLY_GOAL" | "DAILY_GOAL"

interface Habit {
  id: string
  name: string
  color: string
}

interface FriendUser {
  id: string
  name: string | null
  image: string | null
  isSelf?: boolean
}

const COLORS = [
  "#8b5cf6", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#ef4444",
]

export default function GroupChallengesPage() {
  const { groupChallenges, isLoading, mutate: mutateGroupChallenges } = useGroupChallenges()
  const { invitations, mutate: mutateInvitations } = useGroupChallengeInvitations()
  const { data: friendUsers = [] } = useSWR<FriendUser[]>("/api/friends")
  const { data: habits = [] } = useSWR<Habit[]>("/api/habits")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false)
  const [integrationChallengeId, setIntegrationChallengeId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState<string | null>(null)
  const [integrationSettings, setIntegrationSettings] = useState<MemberIntegrationSettings>({
    linkedType: "NONE",
    linkedHabitId: undefined,
    minSteps: undefined,
    sportActivityType: undefined,
    minDuration: undefined,
  })
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  // New challenge form
  const [newChallenge, setNewChallenge] = useState({
    name: "",
    description: "",
    challengeType: "DAILY_GOAL" as ChallengeType,
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    targetValue: "",
    unit: "",
    weeklyTarget: "",
    dailyTarget: "",
    linkedType: "NONE" as LinkedDataType,
    color: COLORS[0],
    inviteUserIds: [] as string[],
  })

  // Add progress
  const [addingProgressId, setAddingProgressId] = useState<string | null>(null)
  const [progressValue, setProgressValue] = useState("")

  // Edit challenge
  const [editingChallenge, setEditingChallenge] = useState<GroupChallenge | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    targetValue: "",
    unit: "",
    weeklyTarget: "",
    color: COLORS[0],
  })

  // Detail view
  const [viewingChallenge, setViewingChallenge] = useState<GroupChallenge | null>(null)
  const [detailTab, setDetailTab] = useState<"ranking" | "days" | "chat" | "stats">("ranking")

  // Stats
  const [statsData, setStatsData] = useState<{
    memberStats: Array<{
      memberId: string
      userName: string
      userImage: string | null
      totalEntries: number
      totalSteps: number
      totalDuration: number
      averageSteps: number
      averageDuration: number
      longestStreak: number
      currentStreak: number
    }>
    summary: {
      totalGroupEntries: number
      totalGroupSteps: number
      totalGroupDuration: number
      bestStreak: number
    }
  } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Chat
  const [chatMessage, setChatMessage] = useState("")
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string
    content: string
    createdAt: string
    user: { id: string; name: string | null; image: string | null }
  }>>([])
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-sync on mount for all challenges with integration
  useEffect(() => {
    const syncAllChallenges = async () => {
      if (!groupChallenges || groupChallenges.length === 0) return

      const challengesToSync = groupChallenges.filter(
        (c) => c.userMembership?.linkedType && c.userMembership.linkedType !== "NONE"
      )

      for (const challenge of challengesToSync) {
        try {
          await fetch(`/api/group-challenges/${challenge.id}/sync`, { method: "POST" })
        } catch (error) {
          console.error("Auto-sync error:", error)
        }
      }

      if (challengesToSync.length > 0) {
        mutateGroupChallenges()
      }
    }

    syncAllChallenges()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load chat messages when viewing a challenge
  useEffect(() => {
    const loadMessages = async () => {
      if (!viewingChallenge) return
      try {
        const res = await fetch(`/api/group-challenges/${viewingChallenge.id}/messages`)
        if (res.ok) {
          const data = await res.json()
          setChatMessages(data.messages || [])
        }
      } catch (error) {
        console.error("Error loading messages:", error)
      }
    }

    if (viewingChallenge && detailTab === "chat") {
      loadMessages()
    }
  }, [viewingChallenge, detailTab])

  // Load stats when viewing stats tab
  useEffect(() => {
    const loadStats = async () => {
      if (!viewingChallenge) return
      setLoadingStats(true)
      try {
        const res = await fetch(`/api/group-challenges/${viewingChallenge.id}/stats`)
        if (res.ok) {
          const data = await res.json()
          setStatsData(data)
        }
      } catch (error) {
        console.error("Error loading stats:", error)
      } finally {
        setLoadingStats(false)
      }
    }

    if (viewingChallenge && detailTab === "stats") {
      loadStats()
    }
  }, [viewingChallenge, detailTab])

  // Scroll chat to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleCreateChallenge = async () => {
    if (!newChallenge.name || !newChallenge.endDate) {
      return
    }

    if (newChallenge.challengeType === "WEEKLY_HABIT" && !newChallenge.weeklyTarget) {
      return
    }

    // Calculate target value based on challenge type
    let targetValue = newChallenge.targetValue
    const daysDiff = differenceInDays(new Date(newChallenge.endDate), new Date(newChallenge.startDate)) + 1

    if (newChallenge.challengeType === "WEEKLY_HABIT" && newChallenge.startDate && newChallenge.endDate) {
      targetValue = Math.ceil(daysDiff / 7).toString()
    }
    if (newChallenge.challengeType === "MONTHLY_GOAL" && newChallenge.startDate && newChallenge.endDate) {
      const start = new Date(newChallenge.startDate)
      const end = new Date(newChallenge.endDate)
      targetValue = ((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1).toString()
    }
    if (newChallenge.challengeType === "DAILY_GOAL" && newChallenge.startDate && newChallenge.endDate) {
      targetValue = daysDiff.toString()
    }

    if (!targetValue && newChallenge.challengeType === "NUMERIC") {
      return
    }
    if (!newChallenge.unit && newChallenge.challengeType === "NUMERIC") {
      return
    }

    // Set unit based on type
    let unit = newChallenge.unit
    if (newChallenge.challengeType === "WEEKLY_HABIT") unit = "tygodni"
    if (newChallenge.challengeType === "MONTHLY_GOAL") unit = "miesięcy"
    if (newChallenge.challengeType === "DAILY_GOAL") unit = "dni"

    try {
      const res = await fetch("/api/group-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newChallenge, targetValue, unit }),
      })
      if (res.ok) {
        mutateGroupChallenges()
        setNewChallenge({
          name: "",
          description: "",
          challengeType: "DAILY_GOAL",
          startDate: format(new Date(), "yyyy-MM-dd"),
          endDate: "",
          targetValue: "",
          unit: "",
          weeklyTarget: "",
          dailyTarget: "",
          linkedType: "NONE",
          color: COLORS[0],
          inviteUserIds: [],
        })
        setIsDialogOpen(false)
      }
    } catch (error) {
      console.error("Error creating group challenge:", error)
    }
  }

  const handleAddProgress = async (challengeId: string) => {
    if (!progressValue) return

    try {
      await fetch(`/api/group-challenges/${challengeId}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: progressValue }),
      })
      mutateGroupChallenges()
      setAddingProgressId(null)
      setProgressValue("")
    } catch (error) {
      console.error("Error adding progress:", error)
    }
  }

  const handleToggleDay = async (challengeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    try {
      await fetch(`/api/group-challenges/${challengeId}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 1, date: dateStr, toggle: true }),
      })
      mutateGroupChallenges()
    } catch (error) {
      console.error("Error toggling day:", error)
    }
  }

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to wyzwanie grupowe?")) return
    try {
      await fetch(`/api/group-challenges/${id}`, { method: "DELETE" })
      mutateGroupChallenges()
    } catch (error) {
      console.error("Error deleting challenge:", error)
    }
  }

  const handleLeaveChallenge = async (id: string, userId: string) => {
    if (!confirm("Czy na pewno chcesz opuścić to wyzwanie?")) return
    try {
      await fetch(`/api/group-challenges/${id}/members?userId=${userId}`, { method: "DELETE" })
      mutateGroupChallenges()
    } catch (error) {
      console.error("Error leaving challenge:", error)
    }
  }

  const handleInviteUsers = async () => {
    if (!selectedChallengeId || selectedUserIds.length === 0) return

    try {
      await fetch(`/api/group-challenges/${selectedChallengeId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUserIds }),
      })
      mutateGroupChallenges()
      setIsInviteDialogOpen(false)
      setSelectedChallengeId(null)
      setSelectedUserIds([])
    } catch (error) {
      console.error("Error inviting users:", error)
    }
  }

  const handleRespondToInvitation = async (invitationId: string, action: "accept" | "decline") => {
    try {
      await fetch(`/api/group-challenges/invitations/${invitationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      mutateInvitations()
      mutateGroupChallenges()
    } catch (error) {
      console.error("Error responding to invitation:", error)
    }
  }

  const handleStartEdit = (challenge: GroupChallenge) => {
    setEditingChallenge(challenge)
    setEditForm({
      name: challenge.name,
      description: challenge.description || "",
      startDate: format(new Date(challenge.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(challenge.endDate), "yyyy-MM-dd"),
      targetValue: challenge.targetValue.toString(),
      unit: challenge.unit,
      weeklyTarget: challenge.weeklyTarget?.toString() || "",
      color: challenge.color,
    })
  }

  const handleUpdateChallenge = async () => {
    if (!editingChallenge) return
    try {
      await fetch(`/api/group-challenges/${editingChallenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      mutateGroupChallenges()
      setEditingChallenge(null)
    } catch (error) {
      console.error("Error updating challenge:", error)
    }
  }

  const handleOpenInviteDialog = (challengeId: string) => {
    setSelectedChallengeId(challengeId)
    setSelectedUserIds([])
    setIsInviteDialogOpen(true)
  }

  const handleOpenIntegrationDialog = (challenge: GroupChallenge) => {
    setIntegrationChallengeId(challenge.id)
    const membership = challenge.userMembership
    if (membership) {
      setIntegrationSettings({
        linkedType: membership.linkedType || "NONE",
        linkedHabitId: membership.linkedHabitId || undefined,
        minSteps: membership.minSteps || undefined,
        sportActivityType: membership.sportActivityType || undefined,
        minDuration: membership.minDuration || undefined,
      })
    } else {
      setIntegrationSettings({
        linkedType: "NONE",
        linkedHabitId: undefined,
        minSteps: undefined,
        sportActivityType: undefined,
        minDuration: undefined,
      })
    }
    setIsIntegrationDialogOpen(true)
  }

  const handleSaveIntegration = async () => {
    if (!integrationChallengeId) return

    try {
      await fetch(`/api/group-challenges/${integrationChallengeId}/integration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(integrationSettings),
      })
      mutateGroupChallenges()
      setIsIntegrationDialogOpen(false)
      setIntegrationChallengeId(null)
    } catch (error) {
      console.error("Error saving integration:", error)
    }
  }

  const handleSyncData = async (challengeId: string) => {
    setIsSyncing(challengeId)
    try {
      const res = await fetch(`/api/group-challenges/${challengeId}/sync`, {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        mutateGroupChallenges()
        if (data.newEntriesCount > 0) {
          // Could show a toast here
          console.log(`Zsynchronizowano ${data.newEntriesCount} nowych wpisów`)
        }
      }
    } catch (error) {
      console.error("Error syncing data:", error)
    } finally {
      setIsSyncing(null)
    }
  }

  const handleSendMessage = async () => {
    if (!viewingChallenge || !chatMessage.trim()) return

    setIsSendingMessage(true)
    try {
      const res = await fetch(`/api/group-challenges/${viewingChallenge.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: chatMessage }),
      })
      if (res.ok) {
        const newMsg = await res.json()
        setChatMessages((prev) => [...prev, newMsg])
        setChatMessage("")
      }
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSendingMessage(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
    if (e.key === "Escape") {
      setAddingProgressId(null)
      setProgressValue("")
    }
  }

  const isDayCompleted = (entries: { date: string }[], date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd")
    return entries.some((e) => format(new Date(e.date), "yyyy-MM-dd") === dateStr)
  }

  const getCurrentWeekDays = () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  const getMonthsInRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months: Date[] = []
    const current = startOfMonth(start)
    while (current <= end) {
      months.push(new Date(current))
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }

  // Get available users to invite (not already members or invited)
  const getAvailableUsersForInvite = (challenge: GroupChallenge) => {
    const memberIds = new Set(challenge.members.map((m) => m.user.id))
    const invitedIds = new Set(challenge.invitations?.map((i) => i.user.id) || [])
    return friendUsers.filter(
      (u) => !u.isSelf && !memberIds.has(u.id) && !invitedIds.has(u.id)
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7" />
            Wyzwania grupowe
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Rywalizuj ze znajomymi i osiągajcie cele razem
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nowe wyzwanie grupowe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nowe wyzwanie grupowe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Challenge Type Toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  className={`py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                    newChallenge.challengeType === "DAILY_GOAL"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setNewChallenge({ ...newChallenge, challengeType: "DAILY_GOAL", unit: "dni" })}
                >
                  Codziennie
                </button>
                <button
                  type="button"
                  className={`py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                    newChallenge.challengeType === "WEEKLY_HABIT"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setNewChallenge({ ...newChallenge, challengeType: "WEEKLY_HABIT", unit: "tygodni" })}
                >
                  X razy/tydzień
                </button>
                <button
                  type="button"
                  className={`py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                    newChallenge.challengeType === "MONTHLY_GOAL"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setNewChallenge({ ...newChallenge, challengeType: "MONTHLY_GOAL", unit: "miesięcy" })}
                >
                  Raz/miesiąc
                </button>
                <button
                  type="button"
                  className={`py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                    newChallenge.challengeType === "NUMERIC"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setNewChallenge({ ...newChallenge, challengeType: "NUMERIC", unit: "" })}
                >
                  Cel liczbowy
                </button>
              </div>

              <div>
                <Label>Nazwa</Label>
                <Input
                  value={newChallenge.name}
                  onChange={(e) => setNewChallenge({ ...newChallenge, name: e.target.value })}
                  placeholder={
                    newChallenge.challengeType === "DAILY_GOAL"
                      ? "np. 10000 kroków dziennie"
                      : newChallenge.challengeType === "WEEKLY_HABIT"
                      ? "np. 3x siłownia w tygodniu"
                      : newChallenge.challengeType === "MONTHLY_GOAL"
                      ? "np. Przeczytać 1 książkę miesięcznie"
                      : "np. Przebiec 100km"
                  }
                />
              </div>
              <div>
                <Label>Opis (opcjonalnie)</Label>
                <Input
                  value={newChallenge.description}
                  onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                  placeholder="Szczegóły wyzwania..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data rozpoczęcia</Label>
                  <Input
                    type="date"
                    value={newChallenge.startDate}
                    onChange={(e) => setNewChallenge({ ...newChallenge, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data zakończenia</Label>
                  <Input
                    type="date"
                    value={newChallenge.endDate}
                    onChange={(e) => setNewChallenge({ ...newChallenge, endDate: e.target.value })}
                  />
                </div>
              </div>

              {newChallenge.challengeType === "DAILY_GOAL" ? (
                <div>
                  {newChallenge.startDate && newChallenge.endDate && (
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                      Cel: odhacz każdy dzień ({differenceInDays(new Date(newChallenge.endDate), new Date(newChallenge.startDate)) + 1} dni)
                    </p>
                  )}
                </div>
              ) : newChallenge.challengeType === "WEEKLY_HABIT" ? (
                <div className="space-y-4">
                  <div>
                    <Label>Ile razy w tygodniu</Label>
                    <Input
                      type="number"
                      min="1"
                      max="7"
                      value={newChallenge.weeklyTarget}
                      onChange={(e) => setNewChallenge({ ...newChallenge, weeklyTarget: e.target.value })}
                      placeholder="np. 3"
                    />
                  </div>
                  {newChallenge.startDate && newChallenge.endDate && (
                    <p className="text-xs text-muted-foreground">
                      Cel: {Math.ceil((differenceInDays(new Date(newChallenge.endDate), new Date(newChallenge.startDate)) + 1) / 7)} tygodni
                    </p>
                  )}
                </div>
              ) : newChallenge.challengeType === "MONTHLY_GOAL" ? (
                <div>
                  {newChallenge.startDate && newChallenge.endDate && (() => {
                    const start = new Date(newChallenge.startDate)
                    const end = new Date(newChallenge.endDate)
                    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
                    return (
                      <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                        Cel: odhacz każdy miesiąc ({months} miesięcy)
                      </p>
                    )
                  })()}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cel</Label>
                    <Input
                      type="number"
                      value={newChallenge.targetValue}
                      onChange={(e) => setNewChallenge({ ...newChallenge, targetValue: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <Label>Jednostka</Label>
                    <Input
                      value={newChallenge.unit}
                      onChange={(e) => setNewChallenge({ ...newChallenge, unit: e.target.value })}
                      placeholder="km, kroków..."
                    />
                  </div>
                </div>
              )}

              <div>
                <Label>Kolor</Label>
                <div className="flex gap-2 mt-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        newChallenge.color === color ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewChallenge({ ...newChallenge, color })}
                    />
                  ))}
                </div>
              </div>

              {/* Invite users */}
              <div className="border-t pt-4">
                <Label className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Zaproś znajomych
                </Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {friendUsers.filter((u) => !u.isSelf).map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => {
                        if (newChallenge.inviteUserIds.includes(user.id)) {
                          setNewChallenge({
                            ...newChallenge,
                            inviteUserIds: newChallenge.inviteUserIds.filter((id) => id !== user.id),
                          })
                        } else {
                          setNewChallenge({
                            ...newChallenge,
                            inviteUserIds: [...newChallenge.inviteUserIds, user.id],
                          })
                        }
                      }}
                    >
                      <Checkbox
                        checked={newChallenge.inviteUserIds.includes(user.id)}
                        className="pointer-events-none"
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{user.name}</span>
                    </div>
                  ))}
                  {friendUsers.filter((u) => !u.isSelf).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Brak znajomych do zaproszenia
                    </p>
                  )}
                </div>
              </div>

              <Button onClick={handleCreateChallenge} className="w-full">
                Utwórz wyzwanie grupowe
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Integration tip */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
        <Settings className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-medium">Automatyczna synchronizacja:</span>{" "}
          <span className="text-muted-foreground">
            Kliknij <Settings className="h-3.5 w-3.5 inline mx-0.5" /> przy wyzwaniu, aby podpiąć je pod swoje kroki, aktywności sportowe lub nawyki.
            Postęp będzie się aktualizował automatycznie na podstawie danych z innych zakładek.
          </span>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Zaproszenia ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: inv.challenge.color }}
                  />
                  <div>
                    <div className="font-medium text-sm">{inv.challenge.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      Od: {inv.challenge.creator.name}
                      <span className="mx-1">•</span>
                      <Users className="h-3 w-3" />
                      {inv.challenge._count.members} uczestników
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespondToInvitation(inv.id, "decline")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRespondToInvitation(inv.id, "accept")}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Dołącz
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <div className="text-sm text-muted-foreground">Aktywne wyzwania</div>
            <div className="text-2xl font-bold">{groupChallenges.length}</div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">Łącznie uczestników</div>
              <div className="text-2xl font-bold">
                {groupChallenges.reduce((acc, c) => acc + c.members.length, 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Challenges Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {groupChallenges.map((challenge) => {
          const userProgress = challenge.userMembership?.currentValue || 0
          const progress = (userProgress / challenge.targetValue) * 100
          const progressCapped = Math.min(100, progress)
          const daysLeft = differenceInDays(new Date(challenge.endDate), new Date())
          const isOverdue = daysLeft < 0
          const weekDays = getCurrentWeekDays()
          const months = challenge.challengeType === "MONTHLY_GOAL"
            ? getMonthsInRange(challenge.startDate, challenge.endDate)
            : []
          const userEntries = challenge.userMembership?.entries || []
          const availableUsersForInvite = getAvailableUsersForInvite(challenge)

          // Sort members by progress (descending)
          const sortedMembers = [...challenge.members].sort(
            (a, b) => b.currentValue - a.currentValue
          )

          return (
            <Card key={challenge.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: challenge.color }}
                    />
                    <CardTitle className="text-sm md:text-base">{challenge.name}</CardTitle>
                    {challenge.challengeType === "DAILY_GOAL" && (
                      <Badge variant="secondary" className="text-[10px]">
                        codziennie
                      </Badge>
                    )}
                    {challenge.challengeType === "WEEKLY_HABIT" && (
                      <Badge variant="secondary" className="text-[10px]">
                        {challenge.weeklyTarget}x/tyg
                      </Badge>
                    )}
                    {challenge.challengeType === "MONTHLY_GOAL" && (
                      <Badge variant="secondary" className="text-[10px]">
                        1x/mies
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {challenge.userMembership?.isCompleted && (
                      <Badge className="bg-green-100 text-green-700">
                        <Trophy className="h-3 w-3 mr-1" />
                        Ukończone
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingChallenge(challenge)}>
                          <Users className="h-3.5 w-3.5 mr-2" />
                          Szczegóły
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenIntegrationDialog(challenge)}>
                          <Settings className="h-3.5 w-3.5 mr-2" />
                          Integracja
                        </DropdownMenuItem>
                        {challenge.userMembership?.linkedType !== "NONE" && (
                          <DropdownMenuItem
                            onClick={() => handleSyncData(challenge.id)}
                            disabled={isSyncing === challenge.id}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isSyncing === challenge.id ? "animate-spin" : ""}`} />
                            {isSyncing === challenge.id ? "Synchronizuję..." : "Synchronizuj dane"}
                          </DropdownMenuItem>
                        )}
                        {availableUsersForInvite.length > 0 && (
                          <DropdownMenuItem onClick={() => handleOpenInviteDialog(challenge.id)}>
                            <UserPlus className="h-3.5 w-3.5 mr-2" />
                            Zaproś
                          </DropdownMenuItem>
                        )}
                        {challenge.isCreator && (
                          <>
                            <DropdownMenuItem onClick={() => handleStartEdit(challenge)}>
                              <Edit2 className="h-3.5 w-3.5 mr-2" />
                              Edytuj
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteChallenge(challenge.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Usuń
                            </DropdownMenuItem>
                          </>
                        )}
                        {!challenge.isCreator && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => challenge.userMembership && handleLeaveChallenge(challenge.id, challenge.userMembership.id)}
                            >
                              <LogOut className="h-3.5 w-3.5 mr-2" />
                              Opuść
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {challenge.description && (
                  <p className="text-sm text-muted-foreground">{challenge.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Your Progress */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Twój postęp:</div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      {userProgress} / {challenge.targetValue} {challenge.unit}
                    </span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progressCapped} className="h-2" />
                </div>

                {/* Daily Goal & Weekly Habit - Day Checkboxes for current week */}
                {(challenge.challengeType === "DAILY_GOAL" || challenge.challengeType === "WEEKLY_HABIT") && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Ten tydzień:</div>
                    <div className="flex gap-1 justify-between">
                      {weekDays.map((day) => {
                        const isCompleted = isDayCompleted(userEntries, day)
                        const isToday = isSameDay(day, new Date())
                        const isFuture = day > new Date()
                        const isBeforeStart = day < new Date(challenge.startDate)
                        const isAfterEnd = day > new Date(challenge.endDate)
                        const isOutOfRange = isBeforeStart || isAfterEnd
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => !isFuture && !isOutOfRange && handleToggleDay(challenge.id, day)}
                            disabled={isFuture || isOutOfRange}
                            className={`
                              h-8 w-8 rounded-lg flex flex-col items-center justify-center text-[10px] transition-all
                              ${isFuture || isOutOfRange ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:scale-110"}
                              ${isCompleted ? "text-white" : "border border-dashed border-muted-foreground/30"}
                              ${isToday && !isCompleted && !isOutOfRange ? "border-primary border-solid" : ""}
                            `}
                            style={{
                              backgroundColor: isCompleted ? challenge.color : "transparent",
                            }}
                          >
                            <span className="font-medium">
                              {format(day, "EEEEE", { locale: pl })}
                            </span>
                            {isCompleted && <Check className="h-3 w-3" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Monthly Goal - Month Checkboxes */}
                {challenge.challengeType === "MONTHLY_GOAL" && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Miesiące:</div>
                    <div className="flex gap-1 flex-wrap">
                      {months.slice(0, 12).map((month) => {
                        const monthStart = startOfMonth(month)
                        const isCompleted = userEntries.some(
                          (e) => getMonth(new Date(e.date)) === getMonth(month) &&
                                 new Date(e.date).getFullYear() === month.getFullYear()
                        )
                        const isCurrentMonth = getMonth(new Date()) === getMonth(month) &&
                                              new Date().getFullYear() === month.getFullYear()
                        const isFuture = monthStart > new Date()
                        return (
                          <button
                            key={month.toISOString()}
                            onClick={() => !isFuture && handleToggleDay(challenge.id, monthStart)}
                            disabled={isFuture}
                            className={`
                              h-7 px-2 rounded flex items-center justify-center text-[10px] transition-all
                              ${isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
                              ${isCompleted ? "text-white" : "border border-dashed border-muted-foreground/30"}
                              ${isCurrentMonth && !isCompleted ? "border-primary border-solid" : ""}
                            `}
                            style={{
                              backgroundColor: isCompleted ? challenge.color : "transparent",
                            }}
                          >
                            {format(month, "MMM", { locale: pl })}
                            {isCompleted && <Check className="h-3 w-3 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add progress - only for NUMERIC */}
                {challenge.challengeType === "NUMERIC" && (
                  <div>
                    {addingProgressId === challenge.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder={`Dodaj ${challenge.unit}...`}
                          value={progressValue}
                          onChange={(e) => setProgressValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, () => handleAddProgress(challenge.id))}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleAddProgress(challenge.id)}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setAddingProgressId(null)
                            setProgressValue("")
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setAddingProgressId(challenge.id)}
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Dodaj postęp
                      </Button>
                    )}
                  </div>
                )}

                {/* Members ranking (top 3) */}
                <div className="border-t pt-3">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Trophy className="h-3 w-3" />
                    Ranking ({challenge.members.length} uczestników)
                  </div>
                  <div className="space-y-1.5">
                    {sortedMembers.slice(0, 3).map((member, index) => {
                      const memberProgress = (member.currentValue / challenge.targetValue) * 100
                      const isLeader = index === 0 && member.currentValue > 0
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-2"
                        >
                          <span className="text-xs font-bold w-4">
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                          </span>
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={member.user.image || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(member.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs flex-1 truncate">
                            {member.user.name}
                            {isLeader && (
                              <Crown className="h-3 w-3 inline ml-1 text-yellow-500" />
                            )}
                          </span>
                          <span className="text-xs font-medium">
                            {Math.round(memberProgress)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {challenge.members.length > 3 && (
                    <button
                      className="text-xs text-primary hover:underline mt-2"
                      onClick={() => setViewingChallenge(challenge)}
                    >
                      Zobacz wszystkich →
                    </button>
                  )}
                </div>

                {/* Integration status & sync */}
                {challenge.userMembership?.linkedType && challenge.userMembership.linkedType !== "NONE" && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {challenge.userMembership.linkedType === "STEPS" && (
                        <>
                          <Footprints className="h-3.5 w-3.5" />
                          <span>Kroki {challenge.userMembership.minSteps ? `(min. ${challenge.userMembership.minSteps})` : ""}</span>
                        </>
                      )}
                      {challenge.userMembership.linkedType === "SPORT" && (
                        <>
                          <Dumbbell className="h-3.5 w-3.5" />
                          <span>
                            Sport{challenge.userMembership.sportActivityType ? `: ${challenge.userMembership.sportActivityType}` : ""}
                            {challenge.userMembership.minDuration ? ` (min. ${challenge.userMembership.minDuration} min)` : ""}
                          </span>
                        </>
                      )}
                      {challenge.userMembership.linkedType === "HABIT" && (
                        <>
                          <Target className="h-3.5 w-3.5" />
                          <span>Nawyk</span>
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleSyncData(challenge.id)}
                      disabled={isSyncing === challenge.id}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing === challenge.id ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(challenge.startDate), "d MMM", { locale: pl })} -{" "}
                    {format(new Date(challenge.endDate), "d MMM yyyy", { locale: pl })}
                  </div>
                  <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px]">
                    {isOverdue ? `${Math.abs(daysLeft)} dni po terminie` : `${daysLeft} dni`}
                  </Badge>
                </div>

                {/* Quick action buttons */}
                <div className="flex gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      setViewingChallenge(challenge)
                      setDetailTab("days")
                    }}
                  >
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    Dni innych
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      setViewingChallenge(challenge)
                      setDetailTab("chat")
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                    Chat
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleOpenIntegrationDialog(challenge)}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty state */}
      {groupChallenges.length === 0 && invitations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Brak wyzwań grupowych</p>
          <p className="text-sm">Kliknij "Nowe wyzwanie grupowe" aby zacząć</p>
        </div>
      )}

      {/* Detail View Dialog */}
      <Dialog open={!!viewingChallenge} onOpenChange={(open) => {
        if (!open) {
          setViewingChallenge(null)
          setDetailTab("ranking")
          setChatMessages([])
          setStatsData(null)
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: viewingChallenge?.color }}
              />
              {viewingChallenge?.name}
            </DialogTitle>
          </DialogHeader>
          {viewingChallenge && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {viewingChallenge.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {viewingChallenge.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(viewingChallenge.startDate), "d MMM", { locale: pl })} -{" "}
                  {format(new Date(viewingChallenge.endDate), "d MMM yyyy", { locale: pl })}
                </div>
                <Badge variant="secondary">
                  Cel: {viewingChallenge.targetValue} {viewingChallenge.unit}
                </Badge>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg mb-3">
                <button
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    detailTab === "ranking" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setDetailTab("ranking")}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Ranking
                </button>
                <button
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    detailTab === "days" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setDetailTab("days")}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Dni
                </button>
                <button
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    detailTab === "chat" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setDetailTab("chat")}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Chat
                </button>
                <button
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    detailTab === "stats" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setDetailTab("stats")}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Stats
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Ranking Tab */}
                {detailTab === "ranking" && (
                  <div className="space-y-2">
                    {[...viewingChallenge.members]
                      .sort((a, b) => b.currentValue - a.currentValue)
                      .map((member, index) => {
                        const memberProgress = (member.currentValue / viewingChallenge.targetValue) * 100
                        const isLeader = index === 0 && member.currentValue > 0
                        return (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                          >
                            <span className="text-lg font-bold w-6 text-center">
                              {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`}
                            </span>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.user.image || undefined} />
                              <AvatarFallback>
                                {getInitials(member.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium flex items-center gap-1">
                                {member.user.name}
                                {isLeader && (
                                  <Crown className="h-3.5 w-3.5 text-yellow-500" />
                                )}
                                {member.isCompleted && (
                                  <Badge className="bg-green-100 text-green-700 text-[10px] ml-1">
                                    Ukończone
                                  </Badge>
                                )}
                              </div>
                              <Progress value={Math.min(100, memberProgress)} className="h-1.5 mt-1" />
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold">{Math.round(memberProgress)}%</div>
                              <div className="text-xs text-muted-foreground">
                                {member.currentValue} / {viewingChallenge.targetValue}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                    {/* Pending invitations */}
                    {viewingChallenge.invitations && viewingChallenge.invitations.length > 0 && (
                      <div className="border-t pt-3 mt-3">
                        <h4 className="font-medium mb-2 text-sm flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Oczekujące zaproszenia
                        </h4>
                        <div className="space-y-1.5">
                          {viewingChallenge.invitations.map((inv) => (
                            <div
                              key={inv.id}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={inv.user.image || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(inv.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{inv.user.name}</span>
                              <Badge variant="outline" className="ml-auto text-xs">
                                Oczekuje
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Days Tab */}
                {detailTab === "days" && (
                  <div className="space-y-4">
                    {(viewingChallenge.challengeType === "DAILY_GOAL" || viewingChallenge.challengeType === "WEEKLY_HABIT") && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Ten tydzień - dni odhaczone przez uczestników:
                        </p>
                        {[...viewingChallenge.members]
                          .sort((a, b) => b.currentValue - a.currentValue)
                          .map((member, index) => {
                            const memberEntries = member.entries || []
                            const weekDays = getCurrentWeekDays()
                            const isLeader = index === 0 && member.currentValue > 0
                            return (
                              <div key={member.id} className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2 mb-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={member.user.image || undefined} />
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(member.user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{member.user.name}</span>
                                  {isLeader && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                                </div>
                                <div className="flex gap-1 justify-between">
                                  {weekDays.map((day) => {
                                    const isCompleted = isDayCompleted(memberEntries, day)
                                    const isToday = isSameDay(day, new Date())
                                    return (
                                      <div
                                        key={day.toISOString()}
                                        className={`
                                          h-7 w-7 rounded flex flex-col items-center justify-center text-[10px]
                                          ${isCompleted ? "text-white" : "border border-dashed border-muted-foreground/30"}
                                          ${isToday && !isCompleted ? "border-primary border-solid" : ""}
                                        `}
                                        style={{
                                          backgroundColor: isCompleted ? viewingChallenge.color : "transparent",
                                        }}
                                      >
                                        <span className="font-medium">
                                          {format(day, "EEEEE", { locale: pl })}
                                        </span>
                                        {isCompleted && <Check className="h-2.5 w-2.5" />}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                      </>
                    )}

                    {viewingChallenge.challengeType === "MONTHLY_GOAL" && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Miesiące odhaczone przez uczestników:
                        </p>
                        {[...viewingChallenge.members]
                          .sort((a, b) => b.currentValue - a.currentValue)
                          .map((member, index) => {
                            const memberEntries = member.entries || []
                            const months = getMonthsInRange(viewingChallenge.startDate, viewingChallenge.endDate)
                            const isLeader = index === 0 && member.currentValue > 0
                            return (
                              <div key={member.id} className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2 mb-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={member.user.image || undefined} />
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(member.user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{member.user.name}</span>
                                  {isLeader && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                                </div>
                                <div className="flex gap-1 flex-wrap">
                                  {months.slice(0, 12).map((month) => {
                                    const isCompleted = memberEntries.some(
                                      (e) => getMonth(new Date(e.date)) === getMonth(month) &&
                                             new Date(e.date).getFullYear() === month.getFullYear()
                                    )
                                    return (
                                      <div
                                        key={month.toISOString()}
                                        className={`
                                          h-6 px-2 rounded flex items-center justify-center text-[10px]
                                          ${isCompleted ? "text-white" : "border border-dashed border-muted-foreground/30"}
                                        `}
                                        style={{
                                          backgroundColor: isCompleted ? viewingChallenge.color : "transparent",
                                        }}
                                      >
                                        {format(month, "MMM", { locale: pl })}
                                        {isCompleted && <Check className="h-2.5 w-2.5 ml-0.5" />}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                      </>
                    )}

                    {viewingChallenge.challengeType === "NUMERIC" && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Ten widok jest dostępny tylko dla wyzwań dziennych, tygodniowych i miesięcznych.
                      </p>
                    )}
                  </div>
                )}

                {/* Chat Tab */}
                {detailTab === "chat" && (
                  <div className="flex flex-col h-[300px]">
                    <div
                      ref={chatContainerRef}
                      className="flex-1 overflow-y-auto space-y-2 pr-1"
                    >
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Brak wiadomości</p>
                          <p className="text-xs">Rozpocznij rozmowę!</p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => (
                          <div key={msg.id} className="flex gap-2">
                            <Avatar className="h-6 w-6 flex-shrink-0">
                              <AvatarImage src={msg.user.image || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(msg.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-medium">{msg.user.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(msg.createdAt), "HH:mm", { locale: pl })}
                                </span>
                              </div>
                              <p className="text-sm break-words">{msg.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2 mt-2 pt-2 border-t">
                      <Input
                        placeholder="Napisz wiadomość..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                        className="h-9"
                        disabled={isSendingMessage}
                      />
                      <Button
                        size="icon"
                        className="h-9 w-9"
                        onClick={handleSendMessage}
                        disabled={!chatMessage.trim() || isSendingMessage}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Stats Tab */}
                {detailTab === "stats" && (
                  <div className="space-y-4">
                    {loadingStats ? (
                      <div className="text-center py-8">
                        <RefreshCw className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">Ładowanie statystyk...</p>
                      </div>
                    ) : statsData ? (
                      <>
                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <div className="text-2xl font-bold">{statsData.summary.totalGroupEntries}</div>
                            <div className="text-xs text-muted-foreground">Łączne dni</div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <div className="text-2xl font-bold flex items-center justify-center gap-1">
                              <Flame className="h-5 w-5 text-orange-500" />
                              {statsData.summary.bestStreak}
                            </div>
                            <div className="text-xs text-muted-foreground">Najdłuższy streak</div>
                          </div>
                          {statsData.summary.totalGroupSteps > 0 && (
                            <div className="p-3 rounded-lg bg-muted/50 text-center">
                              <div className="text-2xl font-bold">
                                {(statsData.summary.totalGroupSteps / 1000).toFixed(0)}k
                              </div>
                              <div className="text-xs text-muted-foreground">Łączne kroki</div>
                            </div>
                          )}
                          {statsData.summary.totalGroupDuration > 0 && (
                            <div className="p-3 rounded-lg bg-muted/50 text-center">
                              <div className="text-2xl font-bold">
                                {Math.round(statsData.summary.totalGroupDuration / 60)}h
                              </div>
                              <div className="text-xs text-muted-foreground">Łączny czas</div>
                            </div>
                          )}
                        </div>

                        {/* Leaderboards */}
                        <div className="space-y-3">
                          {/* Longest streak */}
                          <div className="p-3 rounded-lg border">
                            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Flame className="h-3.5 w-3.5 text-orange-500" />
                              Najdłuższy streak
                            </div>
                            <div className="space-y-1.5">
                              {statsData.memberStats
                                .sort((a, b) => b.longestStreak - a.longestStreak)
                                .slice(0, 3)
                                .map((member, index) => (
                                  <div key={member.memberId} className="flex items-center gap-2">
                                    <span className="text-xs font-bold w-4">
                                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                    </span>
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={member.userImage || undefined} />
                                      <AvatarFallback className="text-[10px]">
                                        {getInitials(member.userName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs flex-1 truncate">{member.userName}</span>
                                    <span className="text-xs font-medium">{member.longestStreak} dni</span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Current streak */}
                          <div className="p-3 rounded-lg border">
                            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Flame className="h-3.5 w-3.5 text-red-500" />
                              Aktualny streak
                            </div>
                            <div className="space-y-1.5">
                              {statsData.memberStats
                                .sort((a, b) => b.currentStreak - a.currentStreak)
                                .slice(0, 3)
                                .map((member, index) => (
                                  <div key={member.memberId} className="flex items-center gap-2">
                                    <span className="text-xs font-bold w-4">
                                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                    </span>
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={member.userImage || undefined} />
                                      <AvatarFallback className="text-[10px]">
                                        {getInitials(member.userName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs flex-1 truncate">{member.userName}</span>
                                    <span className="text-xs font-medium">{member.currentStreak} dni</span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Total steps (if any) */}
                          {statsData.memberStats.some((m) => m.totalSteps > 0) && (
                            <div className="p-3 rounded-lg border">
                              <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Footprints className="h-3.5 w-3.5" />
                                Łączne kroki
                              </div>
                              <div className="space-y-1.5">
                                {statsData.memberStats
                                  .sort((a, b) => b.totalSteps - a.totalSteps)
                                  .filter((m) => m.totalSteps > 0)
                                  .slice(0, 3)
                                  .map((member, index) => (
                                    <div key={member.memberId} className="flex items-center gap-2">
                                      <span className="text-xs font-bold w-4">
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                      </span>
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={member.userImage || undefined} />
                                        <AvatarFallback className="text-[10px]">
                                          {getInitials(member.userName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs flex-1 truncate">{member.userName}</span>
                                      <span className="text-xs font-medium">
                                        {(member.totalSteps / 1000).toFixed(0)}k
                                        <span className="text-muted-foreground ml-1">
                                          (śr. {(member.averageSteps / 1000).toFixed(1)}k)
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Total duration (if any) */}
                          {statsData.memberStats.some((m) => m.totalDuration > 0) && (
                            <div className="p-3 rounded-lg border">
                              <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Dumbbell className="h-3.5 w-3.5" />
                                Łączny czas aktywności
                              </div>
                              <div className="space-y-1.5">
                                {statsData.memberStats
                                  .sort((a, b) => b.totalDuration - a.totalDuration)
                                  .filter((m) => m.totalDuration > 0)
                                  .slice(0, 3)
                                  .map((member, index) => (
                                    <div key={member.memberId} className="flex items-center gap-2">
                                      <span className="text-xs font-bold w-4">
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                      </span>
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={member.userImage || undefined} />
                                        <AvatarFallback className="text-[10px]">
                                          {getInitials(member.userName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs flex-1 truncate">{member.userName}</span>
                                      <span className="text-xs font-medium">
                                        {Math.round(member.totalDuration / 60)}h {member.totalDuration % 60}m
                                        <span className="text-muted-foreground ml-1">
                                          (śr. {member.averageDuration}m)
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nie udało się załadować statystyk</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite Users Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Zaproś znajomych
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedChallengeId && groupChallenges.find((c) => c.id === selectedChallengeId) && (
                <>
                  {getAvailableUsersForInvite(groupChallenges.find((c) => c.id === selectedChallengeId)!).map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => {
                        if (selectedUserIds.includes(user.id)) {
                          setSelectedUserIds(selectedUserIds.filter((id) => id !== user.id))
                        } else {
                          setSelectedUserIds([...selectedUserIds, user.id])
                        }
                      }}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        className="pointer-events-none"
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback>
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{user.name}</span>
                    </div>
                  ))}
                  {getAvailableUsersForInvite(groupChallenges.find((c) => c.id === selectedChallengeId)!).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Wszyscy znajomi są już członkami lub zaproszeni
                    </p>
                  )}
                </>
              )}
            </div>
            <Button
              onClick={handleInviteUsers}
              disabled={selectedUserIds.length === 0}
              className="w-full"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Zaproś ({selectedUserIds.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Challenge Dialog */}
      <Dialog open={!!editingChallenge} onOpenChange={(open) => !open && setEditingChallenge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj wyzwanie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Opis</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data rozpoczęcia</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Data zakończenia</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cel</Label>
                <Input
                  type="number"
                  value={editForm.targetValue}
                  onChange={(e) => setEditForm({ ...editForm, targetValue: e.target.value })}
                />
              </div>
              {editingChallenge?.challengeType === "NUMERIC" && (
                <div>
                  <Label>Jednostka</Label>
                  <Input
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  />
                </div>
              )}
              {editingChallenge?.challengeType === "WEEKLY_HABIT" && (
                <div>
                  <Label>Razy w tygodniu</Label>
                  <Input
                    type="number"
                    min="1"
                    max="7"
                    value={editForm.weeklyTarget}
                    onChange={(e) => setEditForm({ ...editForm, weeklyTarget: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Kolor</Label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      editForm.color === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditForm({ ...editForm, color })}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleUpdateChallenge} className="w-full">
              Zapisz zmiany
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Integration Settings Dialog */}
      <Dialog open={isIntegrationDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsIntegrationDialogOpen(false)
          setIntegrationChallengeId(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Ustawienia integracji
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Skonfiguruj automatyczne zaczytywanie postępu z innych źródeł danych.
            </p>

            {/* Integration Type Selector */}
            <div>
              <Label>Źródło danych</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                    integrationSettings.linkedType === "NONE"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  }`}
                  onClick={() => setIntegrationSettings({ ...integrationSettings, linkedType: "NONE" })}
                >
                  <Link2Off className="h-5 w-5" />
                  <span className="text-xs font-medium">Brak</span>
                </button>
                <button
                  type="button"
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                    integrationSettings.linkedType === "STEPS"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  }`}
                  onClick={() => setIntegrationSettings({ ...integrationSettings, linkedType: "STEPS" })}
                >
                  <Footprints className="h-5 w-5" />
                  <span className="text-xs font-medium">Kroki</span>
                </button>
                <button
                  type="button"
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                    integrationSettings.linkedType === "SPORT"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  }`}
                  onClick={() => setIntegrationSettings({ ...integrationSettings, linkedType: "SPORT" })}
                >
                  <Dumbbell className="h-5 w-5" />
                  <span className="text-xs font-medium">Sport</span>
                </button>
                <button
                  type="button"
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                    integrationSettings.linkedType === "HABIT"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  }`}
                  onClick={() => setIntegrationSettings({ ...integrationSettings, linkedType: "HABIT" })}
                >
                  <Target className="h-5 w-5" />
                  <span className="text-xs font-medium">Nawyk</span>
                </button>
              </div>
            </div>

            {/* STEPS settings */}
            {integrationSettings.linkedType === "STEPS" && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                <div>
                  <Label>Minimalna liczba kroków</Label>
                  <Input
                    type="number"
                    placeholder="np. 10000"
                    value={integrationSettings.minSteps || ""}
                    onChange={(e) => setIntegrationSettings({
                      ...integrationSettings,
                      minSteps: e.target.value ? parseInt(e.target.value) : undefined,
                    })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dzień zostanie zaliczony, jeśli osiągniesz tę liczbę kroków
                  </p>
                </div>
              </div>
            )}

            {/* SPORT settings */}
            {integrationSettings.linkedType === "SPORT" && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                <div>
                  <Label>Typ aktywności (opcjonalnie)</Label>
                  <Select
                    value={integrationSettings.sportActivityType || "any"}
                    onValueChange={(value) => setIntegrationSettings({
                      ...integrationSettings,
                      sportActivityType: value === "any" ? undefined : value,
                    })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Dowolna aktywność" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Dowolna aktywność</SelectItem>
                      <SelectItem value="Bieganie">Bieganie</SelectItem>
                      <SelectItem value="Jazda na rowerze">Jazda na rowerze</SelectItem>
                      <SelectItem value="Pływanie">Pływanie</SelectItem>
                      <SelectItem value="Siłownia">Siłownia</SelectItem>
                      <SelectItem value="Spacer">Spacer</SelectItem>
                      <SelectItem value="Yoga">Yoga</SelectItem>
                      <SelectItem value="Inne">Inne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Minimalny czas trwania (minuty)</Label>
                  <Input
                    type="number"
                    placeholder="np. 30"
                    value={integrationSettings.minDuration || ""}
                    onChange={(e) => setIntegrationSettings({
                      ...integrationSettings,
                      minDuration: e.target.value ? parseInt(e.target.value) : undefined,
                    })}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* HABIT settings */}
            {integrationSettings.linkedType === "HABIT" && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                <div>
                  <Label>Wybierz nawyk</Label>
                  <Select
                    value={integrationSettings.linkedHabitId || ""}
                    onValueChange={(value) => setIntegrationSettings({
                      ...integrationSettings,
                      linkedHabitId: value || undefined,
                    })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Wybierz nawyk..." />
                    </SelectTrigger>
                    <SelectContent>
                      {habits.map((habit) => (
                        <SelectItem key={habit.id} value={habit.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: habit.color }}
                            />
                            {habit.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dzień zostanie zaliczony, gdy wykonasz wybrany nawyk
                  </p>
                  {habits.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      Nie masz jeszcze żadnych nawyków. Dodaj nawyk w zakładce Nawyki.
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleSaveIntegration} className="w-full">
              Zapisz ustawienia
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
