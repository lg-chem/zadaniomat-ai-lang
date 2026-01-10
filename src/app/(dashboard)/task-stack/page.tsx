"use client"

import { useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { useSession } from "next-auth/react"
import {
  Layers,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  Building2,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TeamTasksTab } from "@/components/teams/team-tasks-tab"
import { SubtaskList, SubtaskProgress, type Subtask } from "@/components/tasks/subtask-list"
import { EditableDescription } from "@/components/tasks/editable-description"
import useSWR from "swr"

interface Task {
  id: string
  title: string
  description?: string
  priority: number
  plannedMinutes?: number
  status: string
  createdAt: string
  category?: {
    id: string
    name: string
    color: string
  }
  user: {
    id: string
    name: string
    email: string
  }
  organization?: {
    id: string
    name: string
  }
  subtasks?: Subtask[]
}

interface TeamMember {
  id: string
  role: "OWNER" | "MEMBER"
  user: {
    id: string
    name: string
    email: string
    image?: string
  }
}

interface TeamCategory {
  id: string
  name: string
  color: string
}

interface Team {
  id: string
  name: string
  ownerId: string
  isOwner?: boolean
  members: TeamMember[]
  categories: TeamCategory[]
}

interface TeamsResponse {
  owned: Team[]
  memberOf: Team[]
}

const priorityLabels: Record<number, { label: string; color: string }> = {
  0: { label: "Brak", color: "bg-gray-100 text-gray-600" },
  1: { label: "Niski", color: "bg-blue-100 text-blue-700" },
  2: { label: "Średni", color: "bg-yellow-100 text-yellow-700" },
  3: { label: "Wysoki", color: "bg-red-100 text-red-700" },
}

export default function TaskStackPage() {
  const { data: session } = useSession()
  const { data: tasks, isLoading, mutate } = useSWR<Task[]>("/api/tasks/stack")
  const { data: teamsData } = useSWR<TeamsResponse>("/api/organizations")

  // Combine owned and member teams
  const allTeams: Team[] = [
    ...(teamsData?.owned?.map(t => ({ ...t, isOwner: true })) || []),
    ...(teamsData?.memberOf?.map(t => ({ ...t, isOwner: false })) || [])
  ]

  const [selectedTeamId, setSelectedTeamId] = useState<string>("")
  const selectedTeam = allTeams.find(t => t.id === selectedTeamId)

  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null)
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  const handleScheduleTask = async () => {
    if (!schedulingTask) return

    try {
      const res = await fetch(`/api/tasks/${schedulingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: scheduleDate,
        }),
      })

      if (res.ok) {
        mutate()
        setSchedulingTask(null)
      }
    } catch (error) {
      console.error("Error scheduling task:", error)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
        }),
      })

      if (res.ok) {
        mutate()
      }
    } catch (error) {
      console.error("Error completing task:", error)
    }
  }

  const handleEditTask = async () => {
    if (!editingTask) return

    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
        }),
      })

      if (res.ok) {
        mutate()
        setEditingTask(null)
      }
    } catch (error) {
      console.error("Error editing task:", error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie?")) return

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        mutate()
      }
    } catch (error) {
      console.error("Error deleting task:", error)
    }
  }

  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setEditTitle(task.title)
    setEditDescription(task.description || "")
  }

  // Handle subtasks change - optimistic update for immediate UI feedback
  const handleSubtasksChange = (taskId: string, newSubtasks: Subtask[]) => {
    const currentTasks = tasks ?? []
    const updatedTasks = currentTasks.map(task =>
      task.id === taskId ? { ...task, subtasks: newSubtasks } : task
    )
    // Update without revalidation - SubtaskList already saved to API
    mutate(updatedTasks, { revalidate: false })
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Layers className="h-7 w-7" />
          Stos zadań
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Zadania przydzielone przez innych, które musisz zaplanować w swoim harmonogramie
        </p>
      </div>

      {/* Tabs for personal vs team tasks */}
      <Tabs defaultValue="my-tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="my-tasks" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Moje zadania
          </TabsTrigger>
          {allTeams.length > 0 && (
            <TabsTrigger value="team-tasks" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Zadania zespołu
            </TabsTrigger>
          )}
        </TabsList>

        {/* My Tasks Tab */}
        <TabsContent value="my-tasks" className="space-y-4 mt-4">
          {/* Stats */}
          <Card>
            <CardContent className="flex items-center gap-8 py-4">
              <div>
                <div className="text-sm text-muted-foreground">Do zaplanowania</div>
                <div className="text-2xl font-bold">{tasks?.length || 0}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Wysoki priorytet</div>
                <div className="text-2xl font-bold text-red-500">
                  {tasks?.filter((t) => t.priority === 3).length || 0}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task List */}
          <Card>
            <CardHeader>
              <CardTitle>Przydzielone zadania</CardTitle>
              <CardDescription>
                Kliknij "Zaplanuj" aby dodać zadanie do swojego harmonogramu
              </CardDescription>
            </CardHeader>
            <CardContent>
          {!tasks || tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Stos jest pusty</p>
              <p className="text-sm">Nie masz żadnych nieprzydzielonych zadań</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{task.title}</span>
                        {task.category && (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: task.category.color,
                              color: task.category.color,
                            }}
                          >
                            {task.category.name}
                          </Badge>
                        )}
                        {task.priority > 0 && (
                          <Badge className={priorityLabels[task.priority].color}>
                            {priorityLabels[task.priority].label}
                          </Badge>
                        )}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <SubtaskProgress subtasks={task.subtasks} />
                        )}
                      </div>

                      {task.description && expandedTaskId !== task.id && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Od: {task.user.name || task.user.email}
                        </span>
                        {task.organization && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {task.organization.name}
                          </span>
                        )}
                        {task.plannedMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.plannedMinutes} min
                          </span>
                        )}
                        <span>
                          {format(new Date(task.createdAt), "d MMM yyyy", { locale: pl })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSchedulingTask(task)
                          setScheduleDate(format(new Date(), "yyyy-MM-dd"))
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Zaplanuj
                      </Button>
                      <Button
                        size="sm"
                        variant={expandedTaskId === task.id ? "default" : "outline"}
                        onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      >
                        {expandedTaskId === task.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Oznacz jako gotowe
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(task)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edytuj tytuł
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Usuń
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedTaskId === task.id && (
                    <div className="px-4 pb-4 space-y-4 border-t pt-4 bg-muted/30">
                      {/* Description */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Opis</Label>
                        <EditableDescription
                          taskId={task.id}
                          initialValue={task.description}
                          onSaved={() => mutate()}
                          placeholder="Dodaj opis zadania..."
                          rows={3}
                        />
                      </div>

                      {/* Subtasks / Checklist */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Lista kontrolna</Label>
                        <SubtaskList
                          taskId={task.id}
                          subtasks={task.subtasks || []}
                          onSubtasksChange={(newSubtasks) => handleSubtasksChange(task.id, newSubtasks)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tasks Tab */}
        {allTeams.length > 0 && (
          <TabsContent value="team-tasks" className="space-y-4 mt-4">
            {/* Team Selector */}
            {allTeams.length > 1 && (
              <div className="flex items-center gap-4">
                <Label>Wybierz zespół:</Label>
                <Select
                  value={selectedTeamId || allTeams[0]?.id || ""}
                  onValueChange={setSelectedTeamId}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Wybierz zespół" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {team.name}
                          {team.isOwner && (
                            <Badge variant="secondary" className="text-xs">Admin</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* TeamTasksTab component */}
            {session?.user?.id && (selectedTeam || allTeams[0]) && (
              <TeamTasksTab
                teamId={(selectedTeam || allTeams[0]).id}
                categories={(selectedTeam || allTeams[0]).categories || []}
                members={(selectedTeam || allTeams[0]).members || []}
                isOwner={(selectedTeam || allTeams[0]).isOwner || false}
                currentUserId={session.user.id}
              />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Schedule Dialog */}
      <Dialog open={!!schedulingTask} onOpenChange={(open) => !open && setSchedulingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zaplanuj zadanie</DialogTitle>
            <DialogDescription>
              Wybierz datę, na którą chcesz zaplanować to zadanie
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">{schedulingTask?.title}</div>
              {schedulingTask?.category && (
                <Badge
                  variant="outline"
                  className="mt-2"
                  style={{
                    borderColor: schedulingTask.category.color,
                    color: schedulingTask.category.color,
                  }}
                >
                  {schedulingTask.category.name}
                </Badge>
              )}
            </div>

            <div>
              <Label>Data wykonania</Label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulingTask(null)}>
              Anuluj
            </Button>
            <Button onClick={handleScheduleTask}>
              <Calendar className="h-4 w-4 mr-2" />
              Zaplanuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj zadanie</DialogTitle>
            <DialogDescription>
              Zmień tytuł lub opis zadania
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Tytuł</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Tytuł zadania"
              />
            </div>

            <div>
              <Label>Opis (opcjonalnie)</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Opis zadania..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              Anuluj
            </Button>
            <Button onClick={handleEditTask} disabled={!editTitle.trim()}>
              <Pencil className="h-4 w-4 mr-2" />
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
