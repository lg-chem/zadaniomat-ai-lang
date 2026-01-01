"use client"

import { useState } from "react"
import { format, startOfWeek, addDays, subWeeks, addWeeks, isSameDay } from "date-fns"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import useSWR from "swr"

interface FriendUser {
  id: string
  name: string | null
  image: string | null
  _count: {
    habits: number
    challenges: number
    sportActivities: number
  }
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
}

export default function FriendsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  // Fetch friends list
  const { data: friends = [], isLoading: isLoadingFriends } = useSWR<FriendUser[]>(
    "/api/friends"
  )

  // Fetch selected friend's data
  const startDate = format(weekStart, "yyyy-MM-dd")
  const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd")
  const { data: friendData, isLoading: isLoadingFriend } = useSWR<FriendData>(
    selectedUserId ? `/api/friends/${selectedUserId}?startDate=${startDate}&endDate=${endDate}` : null
  )

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const handlePrevWeek = () => setWeekStart((w) => subWeeks(w, 1))
  const handleNextWeek = () => setWeekStart((w) => addWeeks(w, 1))
  const handleThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const getCompletionOnDate = (habit: FriendHabit, date: Date): HabitCompletion | undefined => {
    const dateStr = format(date, "yyyy-MM-dd")
    return habit.completions?.find((c) => {
      const completionDate = format(new Date(c.date), "yyyy-MM-dd")
      return completionDate === dateStr
    })
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
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

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleThisWeek}>
              Ten tydzień
            </Button>
            <div className="px-4 py-2 font-medium min-w-[200px] text-center">
              {format(weekStart, "d MMM", { locale: pl })} -{" "}
              {format(addDays(weekStart, 6), "d MMM yyyy", { locale: pl })}
            </div>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
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

                        {/* Week Grid */}
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

                      return (
                        <Card key={challenge.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
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
                            {challenge.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {challenge.description}
                              </p>
                            )}
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>
                                  {challenge.currentValue} / {challenge.targetValue} {challenge.unit}
                                </span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                              </div>
                              <Progress value={progressCapped} className="h-2" />
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(challenge.startDate), "d MMM", { locale: pl })} -{" "}
                              {format(new Date(challenge.endDate), "d MMM yyyy", { locale: pl })}
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

            {/* Empty state */}
            {friendData.habits.length === 0 &&
              friendData.challenges.length === 0 &&
              friendData.sportActivities.length === 0 && (
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
          {friends.map((friend) => (
            <Card
              key={friend.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedUserId(friend.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={friend.image || undefined} />
                    <AvatarFallback>{getInitials(friend.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{friend.name || "Użytkownik"}</div>
                    <div className="text-xs text-muted-foreground">
                      Kliknij aby zobaczyć aktywności
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 text-sm">
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
