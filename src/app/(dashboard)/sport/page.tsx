"use client"

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react"
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  isToday,
} from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  X,
  Dumbbell,
  Footprints,
  Copy,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface SportActivityType {
  id: string
  name: string
  icon?: string | null
  color: string
  isDefault: boolean
  hasBodyParts: boolean
}

interface BodyPart {
  id: string
  name: string
}

interface SportActivity {
  id: string
  date: string
  duration?: number | null
  notes?: string | null
  fromSteps: boolean
  type: SportActivityType
  bodyParts: BodyPart[]
}

interface StepsEntry {
  id: string
  date: string
  count: number
  notes?: string | null
  copiedToActivity: boolean
}

const BODY_PARTS = [
  "klata", "plecy", "barki", "biceps", "triceps", "pośladki", "nogi", "brzuch"
]

const DEFAULT_TYPES = [
  { name: "Siłownia", color: "#ef4444", hasBodyParts: true },
  { name: "Padel", color: "#f59e0b", hasBodyParts: false },
  { name: "Basen", color: "#3b82f6", hasBodyParts: false },
  { name: "Rower", color: "#10b981", hasBodyParts: false },
  { name: "Spacer", color: "#8b5cf6", hasBodyParts: false },
]

export default function SportPage() {
  const [activityTypes, setActivityTypes] = useState<SportActivityType[]>([])
  const [activities, setActivities] = useState<SportActivity[]>([])
  const [steps, setSteps] = useState<StepsEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  // Add activity dialog
  const [isAddingActivity, setIsAddingActivity] = useState(false)
  const [newActivity, setNewActivity] = useState({
    typeId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    duration: "",
    notes: "",
    bodyParts: [] as string[],
  })

  // Add steps
  const [editingStepsDate, setEditingStepsDate] = useState<string | null>(null)
  const [stepsValue, setStepsValue] = useState("")

  // Add custom type
  const [isAddingType, setIsAddingType] = useState(false)
  const [newTypeName, setNewTypeName] = useState("")

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const startDate = format(weekStart, "yyyy-MM-dd")
  const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd")

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/sport/types")
      if (res.ok) {
        const data = await res.json()
        setActivityTypes(data)
      }
    } catch (error) {
      console.error("Error fetching types:", error)
    }
  }, [])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sport/activities?startDate=${startDate}&endDate=${endDate}`
      )
      if (res.ok) {
        const data = await res.json()
        setActivities(data)
      }
    } catch (error) {
      console.error("Error fetching activities:", error)
    }
  }, [startDate, endDate])

  const fetchSteps = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sport/steps?startDate=${startDate}&endDate=${endDate}`
      )
      if (res.ok) {
        const data = await res.json()
        setSteps(data)
      }
    } catch (error) {
      console.error("Error fetching steps:", error)
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    setIsLoading(true)
    fetchTypes()
    fetchActivities()
    fetchSteps()
  }, [fetchTypes, fetchActivities, fetchSteps])

  const handlePrevWeek = () => setWeekStart((w) => subWeeks(w, 1))
  const handleNextWeek = () => setWeekStart((w) => addWeeks(w, 1))
  const handleThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const handleCreateActivity = async () => {
    if (!newActivity.typeId || !newActivity.date) return

    try {
      await fetch("/api/sport/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newActivity,
          duration: newActivity.duration ? parseInt(newActivity.duration) : null,
        }),
      })
      fetchActivities()
      setNewActivity({
        typeId: "",
        date: format(new Date(), "yyyy-MM-dd"),
        duration: "",
        notes: "",
        bodyParts: [],
      })
      setIsAddingActivity(false)
    } catch (error) {
      console.error("Error creating activity:", error)
    }
  }

  const handleDeleteActivity = async (id: string) => {
    try {
      await fetch(`/api/sport/activities/${id}`, { method: "DELETE" })
      fetchActivities()
    } catch (error) {
      console.error("Error deleting activity:", error)
    }
  }

  const handleSaveSteps = async (date: string) => {
    if (!stepsValue) {
      setEditingStepsDate(null)
      return
    }

    try {
      await fetch("/api/sport/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          count: parseInt(stepsValue),
        }),
      })
      fetchSteps()
      setEditingStepsDate(null)
      setStepsValue("")
    } catch (error) {
      console.error("Error saving steps:", error)
    }
  }

  const handleCopyStepsToActivity = async (stepsEntry: StepsEntry) => {
    try {
      await fetch(`/api/sport/steps/${stepsEntry.id}/copy-to-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      fetchActivities()
      fetchSteps()
    } catch (error) {
      console.error("Error copying steps:", error)
    }
  }

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return

    try {
      await fetch("/api/sport/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTypeName }),
      })
      fetchTypes()
      setNewTypeName("")
      setIsAddingType(false)
    } catch (error) {
      console.error("Error creating type:", error)
    }
  }

  const handleBodyPartToggle = (part: string) => {
    setNewActivity((prev) => ({
      ...prev,
      bodyParts: prev.bodyParts.includes(part)
        ? prev.bodyParts.filter((p) => p !== part)
        : [...prev.bodyParts, part],
    }))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
    if (e.key === "Escape") {
      setEditingStepsDate(null)
      setStepsValue("")
    }
  }

  const getStepsForDate = (date: Date): StepsEntry | undefined => {
    const dateStr = format(date, "yyyy-MM-dd")
    return steps.find((s) => format(new Date(s.date), "yyyy-MM-dd") === dateStr)
  }

  const getActivitiesForDate = (date: Date): SportActivity[] => {
    const dateStr = format(date, "yyyy-MM-dd")
    return activities.filter((a) => format(new Date(a.date), "yyyy-MM-dd") === dateStr)
  }

  const selectedType = activityTypes.find((t) => t.id === newActivity.typeId)

  // Stats
  const totalActivities = activities.length
  const totalSteps = steps.reduce((sum, s) => sum + s.count, 0)
  const activeDays = new Set([
    ...activities.map((a) => format(new Date(a.date), "yyyy-MM-dd")),
  ]).size

  // Body parts stats for this week
  const bodyPartsStats = activities
    .filter((a) => a.type.hasBodyParts)
    .flatMap((a) => a.bodyParts)
    .reduce((acc, bp) => {
      acc[bp.name] = (acc[bp.name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Sport</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Śledź aktywność sportową i kroki
          </p>
        </div>

        <div className="flex items-center gap-2 justify-between md:justify-end">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleThisWeek} className="hidden sm:flex px-3 h-9 text-sm">
            Ten tydzień
          </Button>
          <div className="px-2 md:px-4 py-2 font-medium text-xs md:text-sm text-center min-w-[140px] md:min-w-[200px]">
            {format(weekStart, "d MMM", { locale: pl })} -{" "}
            {format(addDays(weekStart, 6), "d MMM yyyy", { locale: pl })}
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="py-3 md:py-4">
          <div className="grid grid-cols-3 md:flex md:items-center gap-4 md:gap-8 mb-3 md:mb-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Treningi</div>
                <div className="text-2xl font-bold">{totalActivities}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Footprints className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-sm text-muted-foreground">Kroki</div>
                <div className="text-2xl font-bold">{totalSteps.toLocaleString()}</div>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Aktywne dni</div>
              <div className="text-2xl font-bold text-orange-500">{activeDays}/7</div>
            </div>
          </div>

          {/* Body parts stats */}
          {Object.keys(bodyPartsStats).length > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Partie mięśniowe w tym tygodniu:</div>
              <div className="flex flex-wrap gap-2">
                {BODY_PARTS.map((part) => {
                  const count = bodyPartsStats[part] || 0
                  return (
                    <div
                      key={part}
                      className={`px-3 py-1 rounded-full text-sm ${
                        count > 0
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {part}
                      {count > 0 && <span className="ml-1 font-bold">×{count}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Aktywność sportowa
          </TabsTrigger>
          <TabsTrigger value="steps" className="flex items-center gap-2">
            <Footprints className="h-4 w-4" />
            Kroki
          </TabsTrigger>
        </TabsList>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 space-y-3 md:space-y-0 md:flex md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base md:text-lg">Aktywności w tym tygodniu</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsAddingType(true)} className="text-xs md:text-sm">
                  <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                  <span className="hidden sm:inline">Nowy typ</span>
                  <span className="sm:hidden">Typ</span>
                </Button>
                <Button size="sm" onClick={() => setIsAddingActivity(true)} className="text-xs md:text-sm">
                  <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                  <span className="hidden sm:inline">Dodaj aktywność</span>
                  <span className="sm:hidden">Dodaj</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                {/* Week header */}
                <div className="grid grid-cols-7 gap-1 p-3 bg-muted/50 border-b">
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`text-center text-sm ${isToday(day) ? "font-bold text-primary" : "text-muted-foreground"}`}
                    >
                      <div>{format(day, "EEE", { locale: pl })}</div>
                      <div className="text-xs">{format(day, "d")}</div>
                    </div>
                  ))}
                </div>

                {/* Activities grid */}
                <div className="grid grid-cols-7 gap-1 p-2 min-h-[200px]">
                  {weekDays.map((day) => {
                    const dayActivities = getActivitiesForDate(day)
                    return (
                      <div
                        key={day.toISOString()}
                        className={`p-2 rounded-lg border min-h-[150px] ${
                          isToday(day) ? "bg-primary/5 border-primary" : "border-transparent"
                        }`}
                      >
                        {dayActivities.map((activity) => (
                          <div
                            key={activity.id}
                            className="mb-2 p-2 rounded text-xs text-white relative group"
                            style={{ backgroundColor: activity.type.color }}
                          >
                            <div className="font-medium">{activity.type.name}</div>
                            {activity.duration && (
                              <div className="flex items-center gap-1 opacity-80">
                                <Clock className="h-3 w-3" />
                                {activity.duration} min
                              </div>
                            )}
                            {activity.bodyParts.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {activity.bodyParts.map((bp) => (
                                  <span key={bp.id} className="bg-white/20 px-1 rounded text-[10px]">
                                    {bp.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {activity.fromSteps && activity.notes && (
                              <div className="mt-1 text-[10px] opacity-80">
                                {parseInt(activity.notes).toLocaleString()} kroków
                              </div>
                            )}
                            <button
                              onClick={() => handleDeleteActivity(activity.id)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Steps Tab */}
        <TabsContent value="steps" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Kroki w tym tygodniu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_120px_120px_100px] gap-2 p-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
                  <div>Dzień</div>
                  <div className="text-center">Kroki</div>
                  <div className="text-center">Cel (10,000)</div>
                  <div>Akcje</div>
                </div>

                {/* Days */}
                {weekDays.map((day) => {
                  const stepsEntry = getStepsForDate(day)
                  const progress = stepsEntry ? Math.min(100, (stepsEntry.count / 10000) * 100) : 0
                  const isFuture = day > new Date()
                  const dateStr = format(day, "yyyy-MM-dd")

                  return (
                    <div
                      key={day.toISOString()}
                      className={`grid grid-cols-[1fr_120px_120px_100px] gap-2 p-3 border-b last:border-b-0 items-center ${
                        isToday(day) ? "bg-primary/5" : ""
                      }`}
                    >
                      {/* Day */}
                      <div className={isToday(day) ? "font-bold text-primary" : ""}>
                        {format(day, "EEEE, d MMM", { locale: pl })}
                      </div>

                      {/* Steps input/display */}
                      <div className="text-center">
                        {editingStepsDate === dateStr ? (
                          <Input
                            type="number"
                            value={stepsValue}
                            onChange={(e) => setStepsValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, () => handleSaveSteps(dateStr))}
                            onBlur={() => handleSaveSteps(dateStr)}
                            className="h-8 text-center"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              if (!isFuture) {
                                setEditingStepsDate(dateStr)
                                setStepsValue(stepsEntry?.count.toString() || "")
                              }
                            }}
                            disabled={isFuture}
                            className={`px-3 py-1 rounded ${
                              isFuture
                                ? "opacity-30"
                                : "hover:bg-muted cursor-pointer"
                            }`}
                          >
                            {stepsEntry ? stepsEntry.count.toLocaleString() : "-"}
                          </button>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              progress >= 100 ? "bg-green-500" : "bg-primary"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10">
                          {Math.round(progress)}%
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        {stepsEntry && !stepsEntry.copiedToActivity && stepsEntry.count >= 5000 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleCopyStepsToActivity(stepsEntry)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Kopiuj
                          </Button>
                        )}
                        {stepsEntry?.copiedToActivity && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Check className="h-3 w-3 mr-1" />
                            skopiowane
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Activity Dialog */}
      <Dialog open={isAddingActivity} onOpenChange={setIsAddingActivity}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj aktywność sportową</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Typ aktywności</Label>
              <Select
                value={newActivity.typeId}
                onValueChange={(v) => setNewActivity({ ...newActivity, typeId: v, bodyParts: [] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz typ..." />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={newActivity.date}
                onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
              />
            </div>

            <div>
              <Label>Czas trwania (minuty)</Label>
              <Input
                type="number"
                value={newActivity.duration}
                onChange={(e) => setNewActivity({ ...newActivity, duration: e.target.value })}
                placeholder="np. 60"
              />
            </div>

            {selectedType?.hasBodyParts && (
              <div>
                <Label>Partie mięśniowe</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {BODY_PARTS.map((part) => (
                    <button
                      key={part}
                      type="button"
                      onClick={() => handleBodyPartToggle(part)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        newActivity.bodyParts.includes(part)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted-foreground/30 hover:border-primary"
                      }`}
                    >
                      {part}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Notatki (opcjonalnie)</Label>
              <Input
                value={newActivity.notes}
                onChange={(e) => setNewActivity({ ...newActivity, notes: e.target.value })}
                placeholder="Dodatkowe informacje..."
              />
            </div>

            <Button onClick={handleCreateActivity} className="w-full">
              Dodaj aktywność
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Type Dialog */}
      <Dialog open={isAddingType} onOpenChange={setIsAddingType}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowy typ aktywności</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="np. Joga, Boks..."
              />
            </div>
            <Button onClick={handleCreateType} className="w-full">
              Dodaj typ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
