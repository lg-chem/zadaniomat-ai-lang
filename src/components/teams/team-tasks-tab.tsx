"use client"

import { useState } from "react"
import useSWR from "swr"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  MessageSquare,
  Edit3,
  Trash2,
  User,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { AssignTaskDialog } from "@/components/teams/assign-task-dialog"
import { TaskComments } from "@/components/tasks/task-comments"
import { SubtaskList, SubtaskProgress, type Subtask } from "@/components/tasks/subtask-list"

interface Category {
  id: string
  name: string
  color: string
}

interface TaskUser {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: number
  plannedMinutes: number | null
  createdAt: string
  category: Category | null
  assignedTo: TaskUser | null
  user: TaskUser
  subtasks: Subtask[]
  _count?: {
    comments: number
  }
}

interface Member {
  id: string
  role: "OWNER" | "MEMBER"
  user: {
    id: string
    name: string
    email: string
    image?: string
  }
}

interface TeamTasksTabProps {
  teamId: string
  categories: Category[]
  members: Member[]
  isOwner: boolean
  currentUserId: string
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "Brak",
  1: "Niski",
  2: "Średni",
  3: "Wysoki",
}

const PRIORITY_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-600",
  1: "bg-green-100 text-green-700",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-red-100 text-red-700",
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
}

export function TeamTasksTab({ teamId, categories, members, isOwner, currentUserId }: TeamTasksTabProps) {
  const [showAssignTask, setShowAssignTask] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"comments" | "details">("details")

  // Fetch tasks assigned by me (I created them for employees)
  const { data: assignedTasks, mutate: mutateAssigned } = useSWR<Task[]>(
    `/api/tasks?organizationId=${teamId}&createdByMe=true`
  )

  // Fetch tasks assigned to me in this team
  const { data: myTasks, mutate: mutateMyTasks } = useSWR<Task[]>(
    `/api/tasks?organizationId=${teamId}&assignedToMe=true`
  )

  const handleOpenAssignTask = (memberId: string | null = null) => {
    setSelectedMemberId(memberId)
    setShowAssignTask(true)
  }

  const handleTaskSuccess = () => {
    mutateAssigned()
    mutateMyTasks()
  }

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      mutateAssigned()
      mutateMyTasks()
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie?")) return

    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      mutateAssigned()
      mutateMyTasks()
    } catch (error) {
      console.error("Error deleting task:", error)
    }
  }

  const handleUpdateDescription = async (taskId: string, description: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description || null }),
      })
      mutateAssigned()
      mutateMyTasks()
    } catch (error) {
      console.error("Error updating description:", error)
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const renderTaskCard = (task: Task, isAssignedByMe: boolean) => {
    const isExpanded = expandedTaskId === task.id
    const hasSubtasks = task.subtasks && task.subtasks.length > 0
    const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0
    const totalSubtasks = task.subtasks?.length || 0
    const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0
    const isTaskOwner = task.user.id === currentUserId

    return (
      <Card key={task.id} className={cn(
        "transition-all",
        task.status === "COMPLETED" && "opacity-60"
      )}>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className={cn(
                  "font-medium",
                  task.status === "COMPLETED" && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {task.category && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: task.category.color }}
                      />
                      <span className="text-xs text-muted-foreground">{task.category.name}</span>
                    </div>
                  )}
                  {task.priority > 0 && (
                    <Badge variant="secondary" className={cn("text-xs", PRIORITY_COLORS[task.priority])}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                  )}
                  <Badge variant="secondary" className={cn("text-xs", STATUS_COLORS[task.status])}>
                    {task.status === "NEW" ? "Nowe" : task.status === "IN_PROGRESS" ? "W trakcie" : "Ukończone"}
                  </Badge>
                  {hasSubtasks && <SubtaskProgress subtasks={task.subtasks} />}
                </div>
              </div>

              {/* Assignee/Creator avatar */}
              <div className="flex items-center gap-2">
                {isAssignedByMe && task.assignedTo && (
                  <div className="flex items-center gap-1.5" title={`Przypisane do: ${task.assignedTo.name || task.assignedTo.email}`}>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.assignedTo.image || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(task.assignedTo.name, task.assignedTo.email)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                {!isAssignedByMe && (
                  <div className="flex items-center gap-1.5" title={`Od: ${task.user.name || task.user.email}`}>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.user.image || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(task.user.name, task.user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar for subtasks */}
            {hasSubtasks && (
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground">{completedSubtasks}/{totalSubtasks}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {task.status !== "COMPLETED" && (
                <>
                  {task.status === "NEW" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleUpdateTaskStatus(task.id, "IN_PROGRESS")}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Rozpocznij
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleUpdateTaskStatus(task.id, "COMPLETED")}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Ukończ
                  </Button>
                </>
              )}
              {task.status === "COMPLETED" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleUpdateTaskStatus(task.id, "NEW")}
                >
                  Cofnij
                </Button>
              )}
              <Button
                size="sm"
                variant={isExpanded ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
              >
                {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                Szczegóły
              </Button>
              {(isAssignedByMe || isTaskOwner) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDeleteTask(task.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t pt-3 mt-2 space-y-4">
                {/* Tab switcher */}
                <div className="flex gap-2 border-b pb-2">
                  <Button
                    size="sm"
                    variant={activeTab === "details" ? "default" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setActiveTab("details")}
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    Opis i lista
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === "comments" ? "default" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setActiveTab("comments")}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Dyskusja
                  </Button>
                </div>

                {activeTab === "details" && (
                  <div className="space-y-4">
                    {/* Description */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis</label>
                      <Textarea
                        defaultValue={task.description || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (task.description || "")) {
                            handleUpdateDescription(task.id, e.target.value)
                          }
                        }}
                        placeholder="Dodaj opis zadania..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>

                    {/* Subtasks/Checklist */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Lista kontrolna</label>
                      <SubtaskList
                        taskId={task.id}
                        subtasks={task.subtasks || []}
                        onSubtasksChange={() => {
                          mutateAssigned()
                          mutateMyTasks()
                        }}
                      />
                    </div>
                  </div>
                )}

                {activeTab === "comments" && (
                  <TaskComments
                    taskId={task.id}
                    currentUserId={currentUserId}
                    isTaskOwner={isTaskOwner}
                  />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const assignedTasksList = assignedTasks || []
  const myTasksList = myTasks || []

  return (
    <div className="space-y-6">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Zadania zespołu</h3>
          <p className="text-sm text-muted-foreground">
            Zarządzaj zadaniami swoimi i przypisanymi do pracowników
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => handleOpenAssignTask()}>
            <Plus className="h-4 w-4 mr-2" />
            Przypisz zadanie
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tasks assigned by me (for employees) */}
        {isOwner && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <h4 className="font-medium">Zadania przypisane pracownikom</h4>
              <Badge variant="secondary">{assignedTasksList.length}</Badge>
            </div>

            {assignedTasksList.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nie przypisano jeszcze żadnych zadań</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => handleOpenAssignTask()}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Przypisz pierwsze zadanie
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {assignedTasksList.map(task => renderTaskCard(task, true))}
              </div>
            )}
          </div>
        )}

        {/* Tasks assigned to me */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-green-500" />
            <h4 className="font-medium">Moje zadania w zespole</h4>
            <Badge variant="secondary">{myTasksList.length}</Badge>
          </div>

          {myTasksList.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nie masz przypisanych zadań w tym zespole</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myTasksList.map(task => renderTaskCard(task, false))}
            </div>
          )}
        </div>
      </div>

      {/* Assign task dialog */}
      <AssignTaskDialog
        open={showAssignTask}
        onOpenChange={setShowAssignTask}
        organizationId={teamId}
        assignedToId={selectedMemberId}
        categories={categories}
        members={members}
        onSuccess={handleTaskSuccess}
      />
    </div>
  )
}
