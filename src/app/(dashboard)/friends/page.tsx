"use client"

import { useState } from "react"
import {
  format,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subWeeks,
  addWeeks,
  subMonths,
  addMonths,
  isSameDay,
  eachDayOfInterval,
  getDay,
  getMonth,
  differenceInDays,
} from "date-fns"
import { pl } from "date-fns/locale"
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Flame,
  Trophy,
  Check,
  Dumbbell,
  Clock,
  Calendar,
  ArrowLeft,
  CalendarDays,
  Footprints,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import useSWR from "swr"

type ViewMode = "week" | "month"

interface FriendUser {
  id: string
  name: string | null
  image: string | null
  isSelf?: boolean
  _count: {
    habits: number
    challenges: number
    sportActivities: number
    stepsEntries: number
  }
}

interface FriendSteps {
  id: string
  date: string
  count: number
  notes?: string | null
}

interface HabitCompletion {
  id: string
  date: string
  count: number
  minutes?: number | null
}

interface FriendHabit {
  id: string
  name: string
  color: string
  frequency: "DAILY" | "WEEKLY" | "MONTHLY"
  currentStreak: number
  longestStreak: number
  completions: HabitCompletion[]
}

interface ChallengeEntry {
  id: string
  date: string
  value: number
}

interface FriendChallenge {
  id: string
  name: string
  description?: string | null
  challengeType: "NUMERIC" | "WEEKLY_HABIT" | "MONTHLY_GOAL"
  startDate: string
  endDate: string
  targetValue: number
  currentValue: number
  unit: string
  weeklyTarget?: number | null
  isCompleted: boolean
  color: string
  entries: ChallengeEntry[]
}

interface SportActivityType {
  id: string
  name: string
  icon?: string | null
  color: string
}

interface FriendSportActivity {
  id: string
  date: string
  duration?: number | null
  notes?: string | null
  type: SportActivityType
}

interface FriendData {
  user: {
    id: string
    name: string | null
    image: string | null
  }
  habits: FriendHabit[]
  challenges: FriendChallenge[]
  sportActivities: FriendSportActivity[]
  steps: FriendSteps[]
}

export default function FriendsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))

  // Fetch friends list (including self)
  const { data: friends = [], isLoading: isLoadingFriends } = useSWR<FriendUser[]>(
    "/api/friends?includeSelf=true"
  )

  // Calculate date range based on view mode
  const startDate = viewMode === "week"
    ? format(weekStart, "yyyy-MM-dd")
    : format(monthStart, "yyyy-MM-dd")
  const endDate = viewMode === "week"
    ? format(addDays(weekStart, 6), "yyyy-MM-dd")
    : format(endOfMonth(monthStart), "yyyy-MM-dd")

  // Fetch selected friend's data
  const { data: friendData, isLoading: isLoadingFriend } = useSWR<FriendData>(
    selectedUserId ? `/api/friends/${selectedUserId}?startDate=${startDate}&endDate=${endDate}` : null
  )

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const monthDays = eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) })

  // Week navigation
  const handlePrevWeek = () => setWeekStart((w) => subWeeks(w, 1))
  const handleNextWeek = () => setWeekStart((w) => addWeeks(w, 1))
  const handleThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Month navigation
  const handlePrevMonth = () => setMonthStart((m) => subMonths(m, 1))
  const handleNextMonth = () => setMonthStart((m) => addMonths(m, 1))
  const handleThisMonth = () => setMonthStart(startOfMonth(new Date()))

  const getCompletionOnDate = (habit: FriendHabit, date: Date): HabitCompletion | undefined => {
    const dateStr = format(date, "yyyy-MM-dd")
    return habit.completions?.find((c) => {
      const completionDate = format(new Date(c.date), "yyyy-MM-dd")
      return completionDate === dateStr
    })
  }

  const getStepsOnDate = (steps: FriendSteps[], date: Date): FriendSteps | undefined => {
    const dateStr = format(date, "yyyy-MM-dd")
    return steps?.find((s) => {
      const stepsDate = format(new Date(s.date), "yyyy-MM-dd")
      return stepsDate === dateStr
    })
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }

  // Get current week days for challenges
  const getCurrentWeekDays = () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  // Get months in range for monthly challenges
  const getMonthsInRange = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    const months: Date[] = []
    const current = startOfMonth(start)
    while (current <= end) {
      months.push(new Date(current))
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }

  // Check if a day has a challenge entry
  const isChallengeEntryOnDate = (challenge: FriendChallenge, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd")
    return challenge.entries.some((e) => format(new Date(e.date), "yyyy-MM-dd") === dateStr)
  }

  // Loading state
  if (isLoadingFriends) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  // Selected friend detail view
  if (selectedUserId && friendData) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedUserId(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-12 w-12">
              <AvatarImage src={friendData.user.image || undefined} />
              <AvatarFallback>{getInitials(friendData.user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {friendData.user.name || "Użytkownik"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Publiczne aktywności
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            {/* View mode toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === "week" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("week")}
              >
                <Calendar className="h-4 w-4 inline mr-1" />
                Tydzień
              </button>
              <button
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === "month" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("month")}
              >
                <CalendarDays className="h-4 w-4 inline mr-1" />
                Miesiąc
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={viewMode === "week" ? handlePrevWeek : handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={viewMode === "week" ? handleThisWeek : handleThisMonth}>
                {viewMode === "week" ? "Ten tydzień" : "Ten miesiąc"}
              </Button>
              <div className="px-4 py-2 font-medium min-w-[200px] text-center">
                {viewMode === "week" ? (
                  <>
                    {format(weekStart, "d MMM", { locale: pl })} -{" "}
                    {format(addDays(weekStart, 6), "d MMM yyyy", { locale: pl })}
                  </>
                ) : (
                  format(monthStart, "LLLL yyyy", { locale: pl })
                )}
              </div>
              <Button variant="outline" size="icon" onClick={viewMode === "week" ? handleNextWeek : handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {isLoadingFriend ? (
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <>
            {/* Habits Section */}
            {friendData.habits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Nawyki
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {friendData.habits.map((habit) => (
                      <div key={habit.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: habit.color }}
                            />
                            <span className="font-medium">{habit.name}</span>
                            {habit.currentStreak > 0 && (
                              <Badge variant="secondary" className="text-orange-600">
                                <Flame className="h-3 w-3 mr-1" />
                                {habit.currentStreak} dni
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Week/Month Grid */}
                        {viewMode === "week" ? (
                          <div className="flex gap-2 justify-between">
                            {weekDays.map((day) => {
                              const completion = getCompletionOnDate(habit, day)
                              const completed = !!completion
                              const isToday = isSameDay(day, new Date())

                              return (
                                <div key={day.toISOString()} className="flex flex-col items-center gap-1">
                                  <div className={`text-[10px] ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                    <div>{format(day, "EEE", { locale: pl })}</div>
                                    <div className="text-center">{format(day, "d")}</div>
                                  </div>
                                  <div
                                    className={`
                                      h-8 w-8 rounded-lg flex items-center justify-center
                                      ${completed ? "text-white" : "border-2 border-dashed border-muted-foreground/30"}
                                    `}
                                    style={{
                                      backgroundColor: completed ? habit.color : "transparent",
                                    }}
                                  >
                                    {completed && <Check className="h-4 w-4" />}
                                  </div>
                                  {completed && completion.minutes && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {completion.minutes}m
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-7 gap-1">
                            {/* Day headers */}
                            {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((day) => (
                              <div key={day} className="text-[10px] text-center text-muted-foreground font-medium py-1">
                                {day}
                              </div>
                            ))}
                            {/* Empty cells for days before month start */}
                            {Array.from({ length: (getDay(monthStart) + 6) % 7 }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {/* Month days */}
                            {monthDays.map((day) => {
                              const completion = getCompletionOnDate(habit, day)
                              const completed = !!completion
                              const isToday = isSameDay(day, new Date())

                              return (
                                <div
                                  key={day.toISOString()}
                                  className={`
                                    h-7 w-full rounded flex items-center justify-center text-[10px]
                                    ${completed ? "text-white" : ""}
                                    ${isToday && !completed ? "ring-1 ring-primary" : ""}
                                  `}
                                  style={{
                                    backgroundColor: completed ? habit.color : "transparent",
                                  }}
                                  title={completed && completion.minutes ? `${completion.minutes}m` : undefined}
                                >
                                  {format(day, "d")}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Challenges Section */}
            {friendData.challenges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Wyzwania
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {friendData.challenges.map((challenge) => {
                      const progress = (challenge.currentValue / challenge.targetValue) * 100
                      const progressCapped = Math.min(100, progress)
                      const challengeWeekDays = getCurrentWeekDays()
                      const months = challenge.challengeType === "MONTHLY_GOAL"
                        ? getMonthsInRange(challenge.startDate, challenge.endDate)
                        : []
                      const daysLeft = differenceInDays(new Date(challenge.endDate), new Date())

                      return (
                        <Card key={challenge.id} className="border">
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: challenge.color }}
                                />
                                <span className="font-medium">{challenge.name}</span>
                                {challenge.isCompleted && (
                                  <Badge className="bg-green-100 text-green-700 text-[10px]">
                                    <Trophy className="h-3 w-3 mr-1" />
                                    Ukończone
                                  </Badge>
                                )}
                              </div>
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

                            {challenge.description && (
                              <p className="text-sm text-muted-foreground">
                                {challenge.description}
                              </p>
                            )}

                            {/* Progress */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>
                                  {challenge.currentValue} / {challenge.targetValue} {challenge.unit}
                                </span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                              </div>
                              <Progress value={progressCapped} className="h-2" />
                            </div>

                            {/* Weekly Habit - Day Visualization */}
                            {challenge.challengeType === "WEEKLY_HABIT" && (
                              <div>
                                <div className="text-xs text-muted-foreground mb-2">Ten tydzień:</div>
                                <div className="flex gap-1 justify-between">
                                  {challengeWeekDays.map((day) => {
                                    const isCompleted = isChallengeEntryOnDate(challenge, day)
                                    const isToday = isSameDay(day, new Date())
                                    const isFuture = day > new Date()
                                    return (
                                      <div
                                        key={day.toISOString()}
                                        className={`
                                          h-8 w-8 rounded-lg flex flex-col items-center justify-center text-[10px]
                                          ${isFuture ? "opacity-30" : ""}
                                          ${isCompleted ? "text-white" : "border border-dashed border-muted-foreground/30"}
                                          ${isToday && !isCompleted ? "border-primary border-solid" : ""}
                                        `}
                                        style={{
                                          backgroundColor: isCompleted ? challenge.color : "transparent",
                                        }}
                                      >
                                        <span className="font-medium">
                                          {format(day, "EEEEE", { locale: pl })}
                                        </span>
                                        {isCompleted && <Check className="h-3 w-3" />}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Monthly Goal - Month Visualization */}
                            {challenge.challengeType === "MONTHLY_GOAL" && (
                              <div>
                                <div className="text-xs text-muted-foreground mb-2">Miesiące:</div>
                                <div className="flex gap-1 flex-wrap">
                                  {months.slice(0, 12).map((month) => {
                                    const isCompleted = challenge.entries.some(
                                      (e) => getMonth(new Date(e.date)) === getMonth(month) &&
                                             new Date(e.date).getFullYear() === month.getFullYear()
                                    )
                                    const isCurrentMonth = getMonth(new Date()) === getMonth(month) &&
                                                          new Date().getFullYear() === month.getFullYear()
                                    const isFuture = startOfMonth(month) > new Date()
                                    return (
                                      <div
                                        key={month.toISOString()}
                                        className={`
                                          h-7 px-2 rounded flex items-center justify-center text-[10px]
                                          ${isFuture ? "opacity-30" : ""}
                                          ${isCompleted ? "text-white" : "border border-dashed border-muted-foreground/30"}
                                          ${isCurrentMonth && !isCompleted ? "border-primary border-solid" : ""}
                                        `}
                                        style={{
                                          backgroundColor: isCompleted ? challenge.color : "transparent",
                                        }}
                                      >
                                        {format(month, "MMM", { locale: pl })}
                                        {isCompleted && <Check className="h-3 w-3 ml-0.5" />}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Dates */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(challenge.startDate), "d MMM", { locale: pl })} -{" "}
                              {format(new Date(challenge.endDate), "d MMM yyyy", { locale: pl })}
                              {!challenge.isCompleted && daysLeft >= 0 && (
                                <Badge variant="secondary" className="text-[10px] ml-auto">
                                  {daysLeft} dni
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sport Activities Section */}
            {friendData.sportActivities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-blue-500" />
                    Aktywność sportowa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {friendData.sportActivities.slice(0, 10).map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: activity.type.color }}
                          >
                            {activity.type.icon || <Dumbbell className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="font-medium">{activity.type.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(activity.date), "d MMMM yyyy", { locale: pl })}
                            </div>
                          </div>
                        </div>
                        {activity.duration && (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            {activity.duration} min
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Steps Section */}
            {friendData.steps && friendData.steps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Footprints className="h-5 w-5 text-emerald-500" />
                    Kroki
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewMode === "week" ? (
                    <div className="flex gap-2 justify-between">
                      {weekDays.map((day) => {
                        const stepsEntry = getStepsOnDate(friendData.steps, day)
                        const isToday = isSameDay(day, new Date())
                        return (
                          <div key={day.toISOString()} className="flex flex-col items-center gap-1">
                            <div className={`text-[10px] ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              <div>{format(day, "EEE", { locale: pl })}</div>
                              <div className="text-center">{format(day, "d")}</div>
                            </div>
                            <div className={`
                              min-w-[60px] h-8 rounded-lg flex items-center justify-center text-xs
                              ${stepsEntry ? "bg-emerald-500 text-white" : "border-2 border-dashed border-muted-foreground/30"}
                            `}>
                              {stepsEntry ? stepsEntry.count.toLocaleString() : "-"}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-1">
                      {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((day) => (
                        <div key={day} className="text-[10px] text-center text-muted-foreground font-medium py-1">
                          {day}
                        </div>
                      ))}
                      {Array.from({ length: (getDay(monthStart) + 6) % 7 }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {monthDays.map((day) => {
                        const stepsEntry = getStepsOnDate(friendData.steps, day)
                        const isToday = isSameDay(day, new Date())
                        return (
                          <div
                            key={day.toISOString()}
                            className={`
                              h-7 w-full rounded flex items-center justify-center text-[10px]
                              ${stepsEntry ? "bg-emerald-500 text-white" : ""}
                              ${isToday && !stepsEntry ? "ring-1 ring-primary" : ""}
                            `}
                            title={stepsEntry ? `${stepsEntry.count.toLocaleString()} kroków` : undefined}
                          >
                            {format(day, "d")}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {/* Total steps */}
                  <div className="mt-4 pt-4 border-t text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {friendData.steps.reduce((sum, s) => sum + s.count, 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      kroków w {viewMode === "week" ? "tym tygodniu" : "tym miesiącu"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {friendData.habits.length === 0 &&
              friendData.challenges.length === 0 &&
              friendData.sportActivities.length === 0 &&
              (!friendData.steps || friendData.steps.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ten użytkownik nie ma żadnych publicznych aktywności</p>
                </div>
              )}
          </>
        )}
      </div>
    )
  }

  // Friends list view
  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Znajomi</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Zobacz publiczne aktywności innych użytkowników
        </p>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <div className="text-sm text-muted-foreground">Aktywni użytkownicy</div>
            <div className="text-2xl font-bold">{friends.length}</div>
          </div>
        </CardContent>
      </Card>

      {/* Friends Grid */}
      {friends.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Sort: self first, then others */}
          {[...friends].sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : 0)).map((friend) => (
            <Card
              key={friend.id}
              className={`cursor-pointer hover:border-primary/50 transition-colors ${
                friend.isSelf ? "border-primary/30 bg-primary/5" : ""
              }`}
              onClick={() => setSelectedUserId(friend.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className={`h-12 w-12 ${friend.isSelf ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                    <AvatarImage src={friend.image || undefined} />
                    <AvatarFallback>{getInitials(friend.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{friend.name || "Użytkownik"}</span>
                      {friend.isSelf && (
                        <Badge variant="secondary" className="text-[10px]">
                          Ja
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {friend.isSelf ? "Zobacz jak widzą Cię inni" : "Kliknij aby zobaczyć aktywności"}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 text-sm flex-wrap">
                  {friend._count.habits > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <span>{friend._count.habits} nawyków</span>
                    </div>
                  )}
                  {friend._count.challenges > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span>{friend._count.challenges} wyzwań</span>
                    </div>
                  )}
                  {friend._count.sportActivities > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Dumbbell className="h-4 w-4 text-blue-500" />
                      <span>{friend._count.sportActivities} treningów</span>
                    </div>
                  )}
                  {friend._count.stepsEntries > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Footprints className="h-4 w-4 text-emerald-500" />
                      <span>{friend._count.stepsEntries} dni kroków</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Brak użytkowników z publicznymi aktywnościami</p>
          <p className="text-sm mt-2">
            Podziel się swoimi nawykami, wyzwaniami lub treningami,<br />
            a inni będą mogli śledzić Twoje postępy!
          </p>
        </div>
      )}
    </div>
  )
}
