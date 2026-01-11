"use client"

import { useState, useCallback, useEffect } from "react"
import { Plus, Target, Check, Trash2, Pencil, ChevronDown, ChevronRight, ChevronUp, Calendar, Zap, Save, X, Sparkles, ListTodo, ArrowRight, BookmarkPlus, Clock } from "lucide-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useGoals } from "@/hooks/use-goals"
import { useCategories } from "@/hooks/use-categories"
import useSWR, { mutate } from "swr"
import { SubtaskList, type Subtask } from "@/components/tasks/subtask-list"
import { EditableDescription } from "@/components/tasks/editable-description"

interface Step {
  id: string
  title: string
  description?: string | null
  isCompleted: boolean
  order: number
  sprintId?: string | null
  sprint?: { id: string; name: string } | null
  taskProgress?: {
    total: number
    completed: number
    percentage: number
  }
}

interface GoalTask {
  id: string
  title: string
  description?: string | null
  status: string
  priority: number
  plannedMinutes?: number | null
  scheduledDate?: string | null
  subtasks?: Subtask[]
  category?: { id: string; name: string; color: string } | null
}

interface Goal {
  id: string
  title: string
  description?: string | null
  targetValue?: number | null
  currentValue: number
  unit?: string | null
  isCompleted: boolean
  isStep?: boolean
  parentGoalId?: string | null
  category?: { id: string; name: string; color: string } | null
  period?: { id: string; name: string } | null
  sprint?: { id: string; name: string } | null
  childGoals?: Goal[]
}

interface Category {
  id: string
  name: string
  color: string
  isStrategic: boolean
}

interface KnowledgeCategory {
  id: string
  name: string
  color: string
  parentId?: string | null
  children?: KnowledgeCategory[]
}

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

interface Period {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  sprints: Sprint[]
}

// Goal card component - moved outside to prevent re-renders
function GoalCard({
  goal,
  onToggleComplete,
  onDelete,
  onEdit,
  onPlanWithAI,
  editingGoalId,
  editingTitle,
  setEditingTitle,
  onSaveEdit,
  onCancelEdit,
  steps,
  onToggleStepComplete,
  onPromoteToSprint,
  onEditStep,
  onSaveStepEdit,
  onCancelStepEdit,
  onDeleteStep,
  editingStepId,
  editingStepTitle,
  setEditingStepTitle,
  sprints,
  isSprintGoal,
  tasks,
  onScheduleTask,
  onCompleteTask,
  onTaskSubtasksChange,
  onRefreshTasks,
  expandedTaskId,
  onExpandTask,
  onEditTask,
  onSaveTaskEdit,
  onCancelTaskEdit,
  editingTaskId,
  editingTaskTitle,
  setEditingTaskTitle,
}: {
  goal: Goal
  onToggleComplete: (goal: Goal) => void
  onDelete: (id: string) => void
  onEdit: (goal: Goal) => void
  onPlanWithAI: (goal: Goal, stage: "planning_steps" | "breakdown_tasks") => void
  editingGoalId: string | null
  editingTitle: string
  setEditingTitle: (title: string) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
  steps?: Step[]
  onToggleStepComplete?: (step: Step) => void
  onPromoteToSprint?: (stepId: string, sprintId: string) => void
  onEditStep?: (step: Step) => void
  onSaveStepEdit?: (stepId: string) => void
  onCancelStepEdit?: () => void
  onDeleteStep?: (stepId: string) => void
  editingStepId?: string | null
  editingStepTitle?: string
  setEditingStepTitle?: (title: string) => void
  sprints?: { id: string; name: string }[]
  isSprintGoal?: boolean
  tasks?: GoalTask[]
  onScheduleTask?: (task: GoalTask, goalId: string) => void
  onCompleteTask?: (taskId: string, goalId: string) => void
  onTaskSubtasksChange?: (taskId: string, goalId: string, subtasks: Subtask[]) => void
  onRefreshTasks?: (goalId: string) => void
  expandedTaskId?: string | null
  onExpandTask?: (taskId: string | null) => void
  onEditTask?: (task: GoalTask) => void
  onSaveTaskEdit?: (taskId: string, goalId: string) => void
  onCancelTaskEdit?: () => void
  editingTaskId?: string | null
  editingTaskTitle?: string
  setEditingTaskTitle?: (title: string) => void
}) {
  const isEditing = editingGoalId === goal.id
  const [showSteps, setShowSteps] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const getProgress = (g: Goal) => {
    if (!g.targetValue) return g.isCompleted ? 100 : 0
    return Math.min(100, (g.currentValue / g.targetValue) * 100)
  }

  const hasSteps = steps && steps.length > 0
  const completedSteps = steps?.filter(s => s.isCompleted).length || 0
  const hasTasks = tasks && tasks.length > 0
  const completedTasks = tasks?.filter(t => t.status === "COMPLETED").length || 0

  return (
    <div
      className={`p-2 rounded border ${
        goal.isCompleted ? "bg-green-50 border-green-200 dark:bg-green-950/20" : "bg-background"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <div className="flex-1 flex gap-1">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSaveEdit(goal.id)
                } else if (e.key === "Escape") {
                  onCancelEdit()
                }
              }}
              className="h-7 text-sm"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onSaveEdit(goal.id)}
            >
              <Save className="h-3 w-3 text-green-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onCancelEdit}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              {(hasSteps || hasTasks) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => {
                    if (hasSteps) setShowSteps(!showSteps)
                    if (hasTasks) setShowTasks(!showTasks)
                  }}
                >
                  {(showSteps || showTasks) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>
              )}
              <span className={`text-sm ${goal.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                {goal.title}
              </span>
              {hasSteps && (
                <Badge variant="outline" className="text-[10px] ml-1">
                  {completedSteps}/{steps.length}
                </Badge>
              )}
              {hasTasks && (
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {completedTasks}/{tasks.length} zadań
                </Badge>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onPlanWithAI(goal, isSprintGoal ? "breakdown_tasks" : "planning_steps")}
                title={isSprintGoal ? "Rozpisz na zadania z AI" : "Zaplanuj kroki z AI"}
              >
                <Sparkles className="h-3 w-3 text-purple-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(goal)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onToggleComplete(goal)}
              >
                <Check className={`h-3 w-3 ${goal.isCompleted ? "text-green-500" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onDelete(goal.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      {goal.targetValue ? (
        <div className="mt-1">
          <Progress value={getProgress(goal)} className="h-1" />
          <span className="text-[10px] text-muted-foreground">
            {goal.currentValue}/{goal.targetValue} {goal.unit}
          </span>
        </div>
      ) : !hasSteps && (
        <Badge variant="secondary" className="text-[10px] mt-1">Cel jakościowy</Badge>
      )}

      {/* Steps (Strategy) section */}
      {showSteps && hasSteps && (
        <div className="mt-2 pl-4 border-l-2 border-purple-200 space-y-1">
          <div className="text-[10px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
            <ListTodo className="h-3 w-3" /> Kroki realizacji
          </div>
          {steps.map((step) => {
            const isStepEditing = editingStepId === step.id
            return (
              <div
                key={step.id}
                className={`flex items-center justify-between p-1.5 rounded text-xs ${
                  step.isCompleted ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/50"
                }`}
              >
                {isStepEditing ? (
                  <div className="flex-1 flex gap-1">
                    <Input
                      value={editingStepTitle}
                      onChange={(e) => setEditingStepTitle?.(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onSaveStepEdit?.(step.id)
                        } else if (e.key === "Escape") {
                          onCancelStepEdit?.()
                        }
                      }}
                      className="h-6 text-xs"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onSaveStepEdit?.(step.id)}
                    >
                      <Save className="h-3 w-3 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onCancelStepEdit}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => onToggleStepComplete?.(step)}
                        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          step.isCompleted ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
                        }`}
                      >
                        {step.isCompleted && <Check className="h-3 w-3" />}
                      </button>
                      <span className={step.isCompleted ? "line-through text-muted-foreground" : ""}>
                        {step.title}
                      </span>
                      {step.sprint && (
                        <Badge variant="outline" className="text-[9px]">
                          {step.sprint.name}
                        </Badge>
                      )}
                      {step.taskProgress && step.taskProgress.total > 0 && (
                        <Badge variant="secondary" className="text-[9px]">
                          {step.taskProgress.completed}/{step.taskProgress.total} zadań
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => onEditStep?.(step)}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => onDeleteStep?.(step.id)}
                      >
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </Button>
                      {sprints && sprints.length > 0 && (
                        <select
                          className="text-[10px] border rounded px-1 py-0.5 bg-background"
                          value={step.sprint?.id || step.sprintId || ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              onPromoteToSprint?.(step.id, e.target.value)
                            }
                          }}
                        >
                          <option value="">Sprint</option>
                          {sprints.map((sprint) => (
                            <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tasks section (for sprint goals) */}
      {showTasks && hasTasks && (
        <div className="mt-2 pl-4 border-l-2 border-green-200 space-y-2">
          <div className="text-[10px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
            <ListTodo className="h-3 w-3" /> Zadania do wykonania
          </div>
          {tasks.map((task) => {
            const isExpanded = expandedTaskId === task.id
            const isTaskEditing = editingTaskId === task.id
            const hasSubtasks = task.subtasks && task.subtasks.length > 0
            const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0
            const isScheduled = !!task.scheduledDate

            return (
              <div
                key={task.id}
                className={`rounded border bg-background ${
                  task.status === "COMPLETED" ? "bg-green-50 dark:bg-green-950/20" : ""
                } ${isScheduled ? "border-blue-200" : ""}`}
              >
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() => onCompleteTask?.(task.id, goal.id)}
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        task.status === "COMPLETED" ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
                      }`}
                    >
                      {task.status === "COMPLETED" && <Check className="h-3 w-3" />}
                    </button>
                    {isTaskEditing ? (
                      <div className="flex-1 flex gap-1">
                        <Input
                          value={editingTaskTitle}
                          onChange={(e) => setEditingTaskTitle?.(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onSaveTaskEdit?.(task.id, goal.id)
                            } else if (e.key === "Escape") {
                              onCancelTaskEdit?.()
                            }
                          }}
                          className="h-6 text-xs"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onSaveTaskEdit?.(task.id, goal.id)}
                        >
                          <Save className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={onCancelTaskEdit}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className={`text-xs ${task.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                        {isScheduled && (
                          <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-700">
                            <Calendar className="h-2 w-2 mr-0.5" />
                            {format(new Date(task.scheduledDate!), "d MMM", { locale: pl })}
                          </Badge>
                        )}
                        {hasSubtasks && (
                          <Badge variant="outline" className="text-[9px]">
                            {completedSubtasks}/{task.subtasks!.length}
                          </Badge>
                        )}
                        {task.plannedMinutes && (
                          <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {task.plannedMinutes}min
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {!isTaskEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => onEditTask?.(task)}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => onExpandTask?.(isExpanded ? null : task.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                      </Button>
                      {!isScheduled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 text-[10px] px-1.5"
                          onClick={() => onScheduleTask?.(task, goal.id)}
                        >
                          <Calendar className="h-2.5 w-2.5 mr-0.5" />
                          Zaplanuj
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[10px] px-1.5 text-blue-600"
                          onClick={() => onScheduleTask?.(task, goal.id)}
                        >
                          <Calendar className="h-2.5 w-2.5 mr-0.5" />
                          Zmień
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-2 border-t pt-2 bg-muted/30">
                    {/* Description */}
                    <div>
                      <div className="text-[10px] font-medium mb-1">Opis</div>
                      <EditableDescription
                        taskId={task.id}
                        initialValue={task.description}
                        onSaved={() => onRefreshTasks?.(goal.id)}
                        placeholder="Dodaj opis..."
                        rows={2}
                      />
                    </div>

                    {/* Subtasks / Checklist */}
                    <div>
                      <div className="text-[10px] font-medium mb-1">Lista kontrolna</div>
                      <SubtaskList
                        taskId={task.id}
                        subtasks={task.subtasks || []}
                        onSubtasksChange={(newSubtasks) => onTaskSubtasksChange?.(task.id, goal.id, newSubtasks)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Category template component - moved outside to prevent re-renders
function CategoryTemplate({
  category,
  periodId,
  sprintId,
  categoryGoals,
  inputValue,
  onInputChange,
  onSave,
  onToggleComplete,
  onDelete,
  onEdit,
  onPlanWithAI,
  editingGoalId,
  editingTitle,
  setEditingTitle,
  onSaveEdit,
  onCancelEdit,
  stepsMap,
  onToggleStepComplete,
  onPromoteToSprint,
  onEditStep,
  onSaveStepEdit,
  onCancelStepEdit,
  onDeleteStep,
  editingStepId,
  editingStepTitle,
  setEditingStepTitle,
  sprints,
  tasksMap,
  onScheduleTask,
  onCompleteTask,
  onTaskSubtasksChange,
  onRefreshTasks,
  expandedTaskId,
  onExpandTask,
  onEditTask,
  onSaveTaskEdit,
  onCancelTaskEdit,
  editingTaskId,
  editingTaskTitle,
  setEditingTaskTitle,
}: {
  category: Category
  periodId?: string
  sprintId?: string
  categoryGoals: Goal[]
  inputValue: string
  onInputChange: (key: string, value: string) => void
  onSave: (categoryId: string, periodId?: string, sprintId?: string) => void
  onToggleComplete: (goal: Goal) => void
  onDelete: (id: string) => void
  onEdit: (goal: Goal) => void
  onPlanWithAI: (goal: Goal, stage: "planning_steps" | "breakdown_tasks") => void
  editingGoalId: string | null
  editingTitle: string
  setEditingTitle: (title: string) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
  stepsMap: Record<string, Step[]>
  onToggleStepComplete: (step: Step) => void
  onPromoteToSprint: (stepId: string, sprintId: string) => void
  onEditStep: (step: Step) => void
  onSaveStepEdit: (stepId: string) => void
  onCancelStepEdit: () => void
  onDeleteStep: (stepId: string) => void
  editingStepId: string | null
  editingStepTitle: string
  setEditingStepTitle: (title: string) => void
  sprints: { id: string; name: string }[]
  tasksMap: Record<string, GoalTask[]>
  onScheduleTask: (task: GoalTask, goalId: string) => void
  onCompleteTask: (taskId: string, goalId: string) => void
  onTaskSubtasksChange: (taskId: string, goalId: string, subtasks: Subtask[]) => void
  onRefreshTasks: (goalId: string) => void
  expandedTaskId: string | null
  onExpandTask: (taskId: string | null) => void
  onEditTask: (task: GoalTask) => void
  onSaveTaskEdit: (taskId: string, goalId: string) => void
  onCancelTaskEdit: () => void
  editingTaskId: string | null
  editingTaskTitle: string
  setEditingTaskTitle: (title: string) => void
}) {
  const key = sprintId ? `sprint-${sprintId}-${category.id}` : `period-${periodId}-${category.id}`

  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="font-medium text-sm">{category.name}</span>
        {categoryGoals.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">{categoryGoals.length}</Badge>
        )}
      </div>

      {/* Existing goals */}
      {categoryGoals.length > 0 && (
        <div className="space-y-2 mb-2">
          {categoryGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onEdit={onEdit}
              onPlanWithAI={onPlanWithAI}
              editingGoalId={editingGoalId}
              editingTitle={editingTitle}
              setEditingTitle={setEditingTitle}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              steps={stepsMap[goal.id]}
              onToggleStepComplete={onToggleStepComplete}
              onPromoteToSprint={onPromoteToSprint}
              onEditStep={onEditStep}
              onSaveStepEdit={onSaveStepEdit}
              onCancelStepEdit={onCancelStepEdit}
              onDeleteStep={onDeleteStep}
              editingStepId={editingStepId}
              editingStepTitle={editingStepTitle}
              setEditingStepTitle={setEditingStepTitle}
              sprints={sprints}
              isSprintGoal={!!sprintId}
              tasks={tasksMap[goal.id]}
              onScheduleTask={onScheduleTask}
              onCompleteTask={onCompleteTask}
              onTaskSubtasksChange={onTaskSubtasksChange}
              onRefreshTasks={onRefreshTasks}
              expandedTaskId={expandedTaskId}
              onExpandTask={onExpandTask}
              onEditTask={onEditTask}
              onSaveTaskEdit={onSaveTaskEdit}
              onCancelTaskEdit={onCancelTaskEdit}
              editingTaskId={editingTaskId}
              editingTaskTitle={editingTaskTitle}
              setEditingTaskTitle={setEditingTaskTitle}
            />
          ))}
        </div>
      )}

      {/* Input for new goal */}
      <div className="flex gap-2">
        <Input
          placeholder="Wpisz cel..."
          value={inputValue}
          onChange={(e) => onInputChange(key, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(category.id, periodId, sprintId)
            }
          }}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2"
          onClick={() => onSave(category.id, periodId, sprintId)}
          disabled={!inputValue.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const { workspace } = useWorkspaceStore()

  // Use SWR hooks for data fetching with cache
  const { goals, isLoading: goalsLoading, mutate: mutateGoals } = useGoals()
  const { categories, isLoading: categoriesLoading } = useCategories()

  // Fetch periods with sprints
  const { data: periods = [], isLoading: periodsLoading } = useSWR<Period[]>(
    `/api/periods?workspace=${workspace}`
  )

  const isLoading = goalsLoading || categoriesLoading || periodsLoading

  // Expanded state - auto-expand active period/sprint on first load
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(() => {
    const activePeriod = periods.find((p: Period) => p.isActive)
    return activePeriod ? new Set([activePeriod.id]) : new Set()
  })
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(() => {
    const activePeriod = periods.find((p: Period) => p.isActive)
    if (activePeriod) {
      const today = new Date()
      const currentSprint = activePeriod.sprints.find((s: Sprint) => {
        const start = new Date(s.startDate)
        const end = new Date(s.endDate)
        return today >= start && today <= end
      })
      return currentSprint ? new Set([currentSprint.id]) : new Set()
    }
    return new Set()
  })

  // Template input states - keyed by "periodId-categoryId" or "sprintId-categoryId"
  const [templateInputs, setTemplateInputs] = useState<Record<string, string>>({})

  // Editing state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editingStepTitle, setEditingStepTitle] = useState("")

  // AI Planning dialog state
  const [aiPlanningGoal, setAiPlanningGoal] = useState<{
    goal: Goal
    stage: "planning_steps" | "breakdown_tasks"
  } | null>(null)
  const [aiMessage, setAiMessage] = useState("")
  const [aiHistory, setAiHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [proposedSteps, setProposedSteps] = useState<{ title: string; description?: string }[]>([])
  const [proposedTasks, setProposedTasks] = useState<{ title: string; description?: string }[]>([])

  // Knowledge save state
  const [knowledgeStep, setKnowledgeStep] = useState<"idle" | "generating" | "review" | "saving" | "saved">("idle")
  const [knowledgeForm, setKnowledgeForm] = useState({ content: "", categoryId: "" })
  const [knowledgeCategories, setKnowledgeCategories] = useState<{ id: string; name: string }[]>([])

  // Steps data - fetch for each goal that has steps
  const [stepsMap, setStepsMap] = useState<Record<string, Step[]>>({})

  // Tasks data - fetch for each sprint goal
  const [tasksMap, setTasksMap] = useState<Record<string, GoalTask[]>>({})
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [schedulingTask, setSchedulingTask] = useState<GoalTask | null>(null)
  const [schedulingGoalId, setSchedulingGoalId] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskTitle, setEditingTaskTitle] = useState("")

  // Fetch steps for all goals
  const fetchStepsForGoals = useCallback(async () => {
    const goalsWithoutSteps = goals.filter(g => !g.isStep && !stepsMap[g.id])
    for (const goal of goalsWithoutSteps) {
      try {
        const res = await fetch(`/api/goals/${goal.id}/steps`)
        if (res.ok) {
          const steps = await res.json()
          if (steps.length > 0) {
            setStepsMap(prev => ({ ...prev, [goal.id]: steps }))
          }
        }
      } catch (error) {
        // Ignore errors for individual fetches
      }
    }
  }, [goals, stepsMap])

  // Fetch steps when goals change
  useEffect(() => {
    if (goals.length > 0) {
      fetchStepsForGoals()
    }
  }, [goals.length, fetchStepsForGoals])

  // Fetch tasks for sprint goals
  const fetchTasksForGoals = useCallback(async () => {
    // Only fetch for sprint goals (goals that have a sprintId)
    const sprintGoals = goals.filter(g => !g.isStep && g.sprint && !tasksMap[g.id])
    for (const goal of sprintGoals) {
      try {
        const res = await fetch(`/api/goals/${goal.id}/tasks`)
        if (res.ok) {
          const tasks = await res.json()
          if (tasks.length > 0) {
            setTasksMap(prev => ({ ...prev, [goal.id]: tasks }))
          }
        }
      } catch (error) {
        // Ignore errors for individual fetches
      }
    }
  }, [goals, tasksMap])

  // Fetch tasks when goals change
  useEffect(() => {
    if (goals.length > 0) {
      fetchTasksForGoals()
    }
  }, [goals.length, fetchTasksForGoals])

  // AI Chat handler
  const handleSendAiMessage = async () => {
    if (!aiMessage.trim() || !aiPlanningGoal || aiLoading) return

    const userMessage = aiMessage.trim()
    setAiMessage("")
    setAiHistory(prev => [...prev, { role: "user", content: userMessage }])
    setAiLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          mode: aiPlanningGoal.stage === "planning_steps" ? "period_goals" : "sprint_goals",
          history: aiHistory,
          goalContext: {
            goalId: aiPlanningGoal.goal.id,
            goalTitle: aiPlanningGoal.goal.title,
            goalDescription: aiPlanningGoal.goal.description,
            stage: aiPlanningGoal.stage,
          },
        }),
      })

      if (res.ok) {
        const data = await res.json()

        if (data.type === "steps_proposal") {
          setProposedSteps(data.steps || [])
          setAiHistory(prev => [...prev, { role: "assistant", content: data.message }])
        } else if (data.type === "tasks_proposal") {
          // Handle tasks proposal - show tasks for acceptance
          setProposedTasks(data.tasks || [])
          setAiHistory(prev => [...prev, { role: "assistant", content: data.message }])
        } else {
          setAiHistory(prev => [...prev, { role: "assistant", content: data.message }])
        }
      } else {
        toast.error("Błąd komunikacji z AI")
      }
    } catch (error) {
      console.error("AI chat error:", error)
      toast.error("Wystąpił błąd")
    } finally {
      setAiLoading(false)
    }
  }

  // Save proposed steps
  const handleSaveSteps = async () => {
    if (!aiPlanningGoal || proposedSteps.length === 0) return

    try {
      const res = await fetch(`/api/goals/${aiPlanningGoal.goal.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: proposedSteps }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Dodano ${data.steps.length} kroków realizacji`)
        setStepsMap(prev => ({ ...prev, [aiPlanningGoal.goal.id]: data.steps }))
        setAiPlanningGoal(null)
        setAiHistory([])
        setProposedSteps([])
        mutateGoals()
      } else {
        toast.error("Nie udało się zapisać kroków")
      }
    } catch (error) {
      console.error("Error saving steps:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Save proposed tasks to schedule
  const handleSaveTasks = async () => {
    if (!aiPlanningGoal || proposedTasks.length === 0) return

    try {
      // Create tasks one by one linked to the goal, inherit category from goal
      let successCount = 0
      for (const task of proposedTasks) {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            goalId: aiPlanningGoal.goal.id,
            categoryId: aiPlanningGoal.goal.category?.id, // Inherit category from goal
            workspaceType: workspace,
          }),
        })
        if (res.ok) successCount++
      }

      if (successCount > 0) {
        toast.success(`Dodano ${successCount} zadań`)
        // Refresh tasks for this goal
        refreshGoalTasks(aiPlanningGoal.goal.id)
        setAiPlanningGoal(null)
        setAiHistory([])
        setProposedTasks([])
        mutateGoals()
      } else {
        toast.error("Nie udało się zapisać zadań")
      }
    } catch (error) {
      console.error("Error saving tasks:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Schedule a task (set scheduledDate)
  const handleScheduleTask = async () => {
    if (!schedulingTask || !schedulingGoalId) return

    try {
      const res = await fetch(`/api/tasks/${schedulingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: scheduleDate,
        }),
      })

      if (res.ok) {
        // Update task in tasksMap with new scheduledDate (don't remove it!)
        setTasksMap(prev => ({
          ...prev,
          [schedulingGoalId]: prev[schedulingGoalId]?.map(t =>
            t.id === schedulingTask.id ? { ...t, scheduledDate: scheduleDate } : t
          ) || []
        }))
        toast.success("Zadanie zaplanowane na " + format(new Date(scheduleDate), "d MMM", { locale: pl }))
        setSchedulingTask(null)
        setSchedulingGoalId(null)
      } else {
        toast.error("Nie udało się zaplanować zadania")
      }
    } catch (error) {
      console.error("Error scheduling task:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Toggle task completion
  const handleCompleteTask = async (taskId: string, goalId: string) => {
    const task = tasksMap[goalId]?.find(t => t.id === taskId)
    if (!task) return

    const newStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED"

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
        }),
      })

      if (res.ok) {
        // Update task status in tasksMap (don't remove!)
        setTasksMap(prev => ({
          ...prev,
          [goalId]: prev[goalId]?.map(t =>
            t.id === taskId ? { ...t, status: newStatus } : t
          ) || []
        }))
        toast.success(newStatus === "COMPLETED" ? "Zadanie ukończone!" : "Zadanie oznaczone jako nieukończone")
      }
    } catch (error) {
      console.error("Error toggling task:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Handle subtasks change
  const handleTaskSubtasksChange = (taskId: string, goalId: string, newSubtasks: Subtask[]) => {
    setTasksMap(prev => ({
      ...prev,
      [goalId]: prev[goalId]?.map(task =>
        task.id === taskId ? { ...task, subtasks: newSubtasks } : task
      ) || []
    }))
  }

  // Edit task title
  const handleEditTask = (task: GoalTask) => {
    setEditingTaskId(task.id)
    setEditingTaskTitle(task.title)
  }

  const handleCancelTaskEdit = () => {
    setEditingTaskId(null)
    setEditingTaskTitle("")
  }

  const handleSaveTaskEdit = async (taskId: string, goalId: string) => {
    if (!editingTaskTitle.trim()) return

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTaskTitle.trim() }),
      })

      if (res.ok) {
        // Update task title in tasksMap
        setTasksMap(prev => ({
          ...prev,
          [goalId]: prev[goalId]?.map(t =>
            t.id === taskId ? { ...t, title: editingTaskTitle.trim() } : t
          ) || []
        }))
        setEditingTaskId(null)
        setEditingTaskTitle("")
        toast.success("Zadanie zaktualizowane")
      } else {
        toast.error("Nie udało się zaktualizować zadania")
      }
    } catch (error) {
      console.error("Error updating task:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Refresh tasks for a goal
  const refreshGoalTasks = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}/tasks`)
      if (res.ok) {
        const tasks = await res.json()
        setTasksMap(prev => ({ ...prev, [goalId]: tasks }))
      }
    } catch (error) {
      console.error("Error refreshing tasks:", error)
    }
  }

  // Fetch knowledge categories
  const fetchKnowledgeCategories = async () => {
    try {
      const res = await fetch(`/api/knowledge/categories?workspace=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        // API returns { strategicCategories, customCategories, allCategories }
        // Use allCategories (flat list) for the select dropdown
        if (data.allCategories && Array.isArray(data.allCategories)) {
          setKnowledgeCategories(data.allCategories.map((c: KnowledgeCategory) => ({
            id: c.id,
            name: c.name
          })))
        }
      }
    } catch (error) {
      console.error("Error fetching knowledge categories:", error)
    }
  }

  // Start saving to knowledge - generate summary
  const handleStartSaveKnowledge = async () => {
    if (aiHistory.length === 0) {
      toast.error("Brak rozmowy do zapisania")
      return
    }

    fetchKnowledgeCategories()
    setKnowledgeStep("generating")

    try {
      const conversationText = aiHistory.map(m =>
        `${m.role === "user" ? "Użytkownik" : "Asystent"}: ${m.content}`
      ).join("\n\n")

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Stwórz zwięzłe podsumowanie poniższej rozmowy. Wyciągnij kluczowe informacje, ustalenia i wnioski. Pisz konkretnie, bez zbędnych wstępów.\n\nRozmowa:\n${conversationText}`,
          mode: "general",
          history: [],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setKnowledgeForm(prev => ({ ...prev, content: data.message }))
        setKnowledgeStep("review")
      } else {
        toast.error("Nie udało się wygenerować podsumowania")
        setKnowledgeStep("idle")
      }
    } catch (error) {
      console.error("Error generating summary:", error)
      toast.error("Wystąpił błąd")
      setKnowledgeStep("idle")
    }
  }

  // Save to knowledge base
  const handleSaveKnowledge = async () => {
    if (!knowledgeForm.content.trim() || !knowledgeForm.categoryId) {
      toast.error("Wypełnij treść i wybierz kategorię")
      return
    }

    setKnowledgeStep("saving")

    try {
      const res = await fetch("/api/knowledge/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: aiPlanningGoal?.goal.title ? `Notatka: ${aiPlanningGoal.goal.title}` : "Notatka z rozmowy AI",
          newInfo: knowledgeForm.content,
          categoryId: knowledgeForm.categoryId,
          workspace: workspace,
        }),
      })

      if (res.ok) {
        setKnowledgeStep("saved")
        mutate("/api/knowledge/categories?workspace=" + workspace)
        mutate((key: unknown) => typeof key === "string" && key.includes("/api/knowledge/entries"), undefined, { revalidate: true })
        toast.success("Zapisano do bazy wiedzy")
        setTimeout(() => setKnowledgeStep("idle"), 2000)
      } else {
        toast.error("Nie udało się zapisać")
        setKnowledgeStep("review")
      }
    } catch (error) {
      console.error("Error saving knowledge:", error)
      toast.error("Wystąpił błąd")
      setKnowledgeStep("review")
    }
  }

  // Open AI planning dialog
  const handlePlanWithAI = (goal: Goal, stage: "planning_steps" | "breakdown_tasks") => {
    setAiPlanningGoal({ goal, stage })
    setAiHistory([])
    setProposedSteps([])
    setProposedTasks([])
    setAiMessage("")
    setKnowledgeStep("idle")
    setKnowledgeForm({ content: "", categoryId: "" })
  }

  // Edit step
  const handleEditStep = (step: Step) => {
    setEditingStepId(step.id)
    setEditingStepTitle(step.title)
  }

  const handleCancelStepEdit = () => {
    setEditingStepId(null)
    setEditingStepTitle("")
  }

  const handleSaveStepEdit = async (stepId: string) => {
    if (!editingStepTitle.trim()) return
    try {
      const res = await fetch(`/api/goals/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingStepTitle.trim() }),
      })
      if (res.ok) {
        // Find parent goal and refresh its steps
        const parentGoalId = Object.keys(stepsMap).find(key =>
          stepsMap[key].some(s => s.id === stepId)
        )
        if (parentGoalId) {
          const stepsRes = await fetch(`/api/goals/${parentGoalId}/steps`)
          if (stepsRes.ok) {
            const steps = await stepsRes.json()
            setStepsMap(prev => ({ ...prev, [parentGoalId]: steps }))
          }
        }
        setEditingStepId(null)
        setEditingStepTitle("")
        toast.success("Krok zaktualizowany")
      } else {
        toast.error("Nie udało się zaktualizować kroku")
      }
    } catch (error) {
      console.error("Error updating step:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Delete step
  const handleDeleteStep = async (stepId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten krok?")) return
    try {
      const res = await fetch(`/api/goals/${stepId}`, { method: "DELETE" })
      if (res.ok) {
        // Find parent goal and refresh its steps
        const parentGoalId = Object.keys(stepsMap).find(key =>
          stepsMap[key].some(s => s.id === stepId)
        )
        if (parentGoalId) {
          const stepsRes = await fetch(`/api/goals/${parentGoalId}/steps`)
          if (stepsRes.ok) {
            const steps = await stepsRes.json()
            setStepsMap(prev => ({ ...prev, [parentGoalId]: steps }))
          }
        }
        mutateGoals()
        toast.success("Krok usunięty")
      } else {
        toast.error("Nie udało się usunąć kroku")
      }
    } catch (error) {
      console.error("Error deleting step:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Toggle step complete
  const handleToggleStepComplete = async (step: Step) => {
    try {
      const res = await fetch(`/api/goals/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !step.isCompleted }),
      })
      if (res.ok) {
        // Refresh steps for parent goal
        const parentGoalId = Object.keys(stepsMap).find(key =>
          stepsMap[key].some(s => s.id === step.id)
        )
        if (parentGoalId) {
          const stepsRes = await fetch(`/api/goals/${parentGoalId}/steps`)
          if (stepsRes.ok) {
            const steps = await stepsRes.json()
            setStepsMap(prev => ({ ...prev, [parentGoalId]: steps }))
          }
        }
        mutateGoals()
        toast.success(step.isCompleted ? "Krok oznaczony jako nieukończony" : "Krok ukończony!")
      }
    } catch (error) {
      console.error("Error toggling step:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Promote step to sprint goal - converts step to a real sprint goal
  const handlePromoteToSprint = async (stepId: string, sprintId: string) => {
    try {
      // Just assign sprintId, keep isStep=true so it shows in BOTH places
      const res = await fetch(`/api/goals/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sprintId,
          // DON'T set isStep: false - keep it as a step so it shows under period goal too
        }),
      })
      if (res.ok) {
        // Refresh steps for parent goal (to update sprint badge)
        const parentGoalId = Object.keys(stepsMap).find(key =>
          stepsMap[key].some(s => s.id === stepId)
        )
        if (parentGoalId) {
          const stepsRes = await fetch(`/api/goals/${parentGoalId}/steps`)
          if (stepsRes.ok) {
            const steps = await stepsRes.json()
            setStepsMap(prev => ({ ...prev, [parentGoalId]: steps }))
          }
        }
        mutateGoals()
        toast.success("Krok przypisany do sprintu")
      }
    } catch (error) {
      console.error("Error assigning step to sprint:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Get all sprints from all periods for dropdown
  const allSprints = periods.flatMap(p => p.sprints.map(s => ({ id: s.id, name: s.name })))

  // Get steps assigned to a specific sprint (from all goals)
  const getStepsForSprint = (sprintId: string): (Step & { parentGoalTitle: string; parentGoalId: string })[] => {
    const result: (Step & { parentGoalTitle: string; parentGoalId: string })[] = []
    for (const [goalId, steps] of Object.entries(stepsMap)) {
      const parentGoal = goals.find(g => g.id === goalId)
      for (const step of steps) {
        // Check both sprint.id (from API) and sprintId (from local state after assignment)
        const stepSprintId = step.sprint?.id || step.sprintId
        if (stepSprintId === sprintId) {
          result.push({
            ...step,
            parentGoalTitle: parentGoal?.title || "Cel",
            parentGoalId: goalId,
          })
        }
      }
    }
    return result
  }

  const handleToggleComplete = async (goal: Goal) => {
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !goal.isCompleted }),
      })
      if (res.ok) {
        mutateGoals()
        toast.success(goal.isCompleted ? "Cel oznaczony jako nieukończony" : "Cel ukończony!")
      } else {
        toast.error("Nie udało się zaktualizować celu")
      }
    } catch (error) {
      console.error("Error updating goal:", error)
      toast.error("Wystąpił błąd")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten cel?")) return
    try {
      const res = await fetch(`/api/goals/${id}`, { method: "DELETE" })
      if (res.ok) {
        mutateGoals()
        toast.success("Cel usunięty")
      } else {
        toast.error("Nie udało się usunąć celu")
      }
    } catch (error) {
      console.error("Error deleting goal:", error)
      toast.error("Wystąpił błąd podczas usuwania")
    }
  }

  const handleEdit = (goal: Goal) => {
    setEditingGoalId(goal.id)
    setEditingTitle(goal.title)
  }

  const handleCancelEdit = () => {
    setEditingGoalId(null)
    setEditingTitle("")
  }

  const handleSaveEdit = async (id: string) => {
    if (!editingTitle.trim()) return
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle.trim() }),
      })
      if (res.ok) {
        setEditingGoalId(null)
        setEditingTitle("")
        mutateGoals()
        toast.success("Cel zaktualizowany")
      } else {
        toast.error("Nie udało się zaktualizować celu")
      }
    } catch (error) {
      console.error("Error updating goal:", error)
      toast.error("Wystąpił błąd")
    }
  }

  // Save goal from template
  const handleSaveFromTemplate = async (
    categoryId: string,
    periodId?: string,
    sprintId?: string
  ) => {
    const key = sprintId ? `sprint-${sprintId}-${categoryId}` : `period-${periodId}-${categoryId}`
    const title = templateInputs[key]?.trim()

    if (!title) return

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          categoryId,
          periodId: periodId || undefined,
          sprintId: sprintId || undefined,
          workspaceType: workspace,
        }),
      })
      if (res.ok) {
        setTemplateInputs((prev) => ({ ...prev, [key]: "" }))
        mutateGoals()
        toast.success("Cel dodany")
      } else {
        toast.error("Nie udało się dodać celu")
      }
    } catch (error) {
      console.error("Error creating goal:", error)
      toast.error("Wystąpił błąd podczas tworzenia celu")
    }
  }

  const handleInputChange = (key: string, value: string) => {
    setTemplateInputs((prev) => ({ ...prev, [key]: value }))
  }

  const togglePeriod = (periodId: string) => {
    const newExpanded = new Set(expandedPeriods)
    if (newExpanded.has(periodId)) {
      newExpanded.delete(periodId)
    } else {
      newExpanded.add(periodId)
    }
    setExpandedPeriods(newExpanded)
  }

  const toggleSprint = (sprintId: string) => {
    const newExpanded = new Set(expandedSprints)
    if (newExpanded.has(sprintId)) {
      newExpanded.delete(sprintId)
    } else {
      newExpanded.add(sprintId)
    }
    setExpandedSprints(newExpanded)
  }

  const strategicCategories = categories.filter((c) => c.isStrategic)

  // Get goals for a specific context (period or sprint) and category
  // Now includes completed goals too!
  const getGoalsForCategory = (categoryId: string, periodId?: string, sprintId?: string) => {
    return goals.filter((g) => {
      // Exclude steps - they are shown under their parent goal
      if (g.isStep) return false
      if (g.category?.id !== categoryId) return false
      if (sprintId) {
        return g.sprint?.id === sprintId
      }
      // Period goals (not assigned to any sprint)
      return g.period?.id === periodId && !g.sprint
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Periods skeleton */}
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <div>
                    <Skeleton className="h-6 w-32 mb-1" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  // Count total goals for a period (period goals + all sprint goals) - excludes steps
  const countPeriodGoals = (periodId: string, sprints: Sprint[]) => {
    const periodGoals = goals.filter(
      (g) => !g.isStep && g.period?.id === periodId && !g.sprint
    ).length
    const sprintGoals = sprints.reduce((acc, s) => {
      return acc + goals.filter((g) => !g.isStep && g.sprint?.id === s.id).length
    }, 0)
    return periodGoals + sprintGoals
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Cele</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Zarządzaj celami okresowymi i sprintowymi
          </p>
        </div>
      </div>

      {/* Info about strategic categories */}
      {strategicCategories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-4 py-4">
            <Target className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Brak kategorii strategicznych</p>
              <p className="text-sm text-muted-foreground">
                Dodaj kategorie strategiczne w Ustawieniach, aby móc tworzyć cele
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Periods with templates */}
      {periods.map((period) => {
        const today = new Date()
        const isCurrentPeriod = new Date(period.startDate) <= today && today <= new Date(period.endDate)
        const totalGoals = countPeriodGoals(period.id, period.sprints)

        return (
          <Card key={period.id} className={isCurrentPeriod ? "border-primary/50" : ""}>
            <Collapsible
              open={expandedPeriods.has(period.id)}
              onOpenChange={() => togglePeriod(period.id)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedPeriods.has(period.id) ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          {period.name}
                          {isCurrentPeriod && (
                            <Badge variant="default" className="text-xs">Aktywny</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(period.startDate), "d MMM yyyy", { locale: pl })} -{" "}
                          {format(new Date(period.endDate), "d MMM yyyy", { locale: pl })}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">{totalGoals} celów</Badge>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Period-level goals - templates for each category */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Cele okresu
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {strategicCategories.map((category) => (
                        <CategoryTemplate
                          key={category.id}
                          category={category}
                          periodId={period.id}
                          categoryGoals={getGoalsForCategory(category.id, period.id)}
                          inputValue={templateInputs[`period-${period.id}-${category.id}`] || ""}
                          onInputChange={handleInputChange}
                          onSave={handleSaveFromTemplate}
                          onToggleComplete={handleToggleComplete}
                          onDelete={handleDelete}
                          onEdit={handleEdit}
                          onPlanWithAI={handlePlanWithAI}
                          editingGoalId={editingGoalId}
                          editingTitle={editingTitle}
                          setEditingTitle={setEditingTitle}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={handleCancelEdit}
                          stepsMap={stepsMap}
                          onToggleStepComplete={handleToggleStepComplete}
                          onPromoteToSprint={handlePromoteToSprint}
                          onEditStep={handleEditStep}
                          onSaveStepEdit={handleSaveStepEdit}
                          onCancelStepEdit={handleCancelStepEdit}
                          onDeleteStep={handleDeleteStep}
                          editingStepId={editingStepId}
                          editingStepTitle={editingStepTitle}
                          setEditingStepTitle={setEditingStepTitle}
                          sprints={allSprints}
                          tasksMap={tasksMap}
                          onScheduleTask={(task, goalId) => {
                            setSchedulingTask(task)
                            setSchedulingGoalId(goalId)
                            setScheduleDate(task.scheduledDate || format(new Date(), "yyyy-MM-dd"))
                          }}
                          onCompleteTask={handleCompleteTask}
                          onTaskSubtasksChange={handleTaskSubtasksChange}
                          onRefreshTasks={refreshGoalTasks}
                          expandedTaskId={expandedTaskId}
                          onExpandTask={setExpandedTaskId}
                          onEditTask={handleEditTask}
                          onSaveTaskEdit={handleSaveTaskEdit}
                          onCancelTaskEdit={handleCancelTaskEdit}
                          editingTaskId={editingTaskId}
                          editingTaskTitle={editingTaskTitle}
                          setEditingTaskTitle={setEditingTaskTitle}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Sprints within period */}
                  {period.sprints.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Sprinty
                      </h3>
                      {period.sprints.map((sprint) => {
                        const today = new Date()
                        const isCurrentSprint =
                          new Date(sprint.startDate) <= today && today <= new Date(sprint.endDate)
                        const sprintGoalsCount = goals.filter(
                          (g) => !g.isStep && g.sprint?.id === sprint.id
                        ).length
                        const sprintSteps = getStepsForSprint(sprint.id)
                        const sprintStepsCount = sprintSteps.length
                        const completedStepsCount = sprintSteps.filter(s => s.isCompleted).length

                        return (
                          <Collapsible
                            key={sprint.id}
                            open={expandedSprints.has(sprint.id)}
                            onOpenChange={() => toggleSprint(sprint.id)}
                          >
                            <div
                              className={`border rounded-lg ${
                                isCurrentSprint ? "border-primary/50 bg-primary/5" : ""
                              }`}
                            >
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-2">
                                    {expandedSprints.has(sprint.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <span className="font-medium">{sprint.name}</span>
                                    {isCurrentSprint && (
                                      <Badge variant="default" className="text-[10px]">
                                        Aktywny
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(sprint.startDate), "d MMM", { locale: pl })} -{" "}
                                      {format(new Date(sprint.endDate), "d MMM", { locale: pl })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {sprintStepsCount > 0 && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        {completedStepsCount}/{sprintStepsCount} kroków
                                      </Badge>
                                    )}
                                    <Badge variant="outline">{sprintGoalsCount} celów</Badge>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 pt-0 space-y-4">
                                  {/* Assigned steps from period goals */}
                                  {sprintSteps.length > 0 && (
                                    <div className="border rounded-lg p-3 bg-purple-50/50 dark:bg-purple-950/20">
                                      <div className="text-xs font-medium mb-2 flex items-center gap-1 text-purple-700 dark:text-purple-300">
                                        <ListTodo className="h-3 w-3" />
                                        Kroki z celów okresu ({completedStepsCount}/{sprintStepsCount})
                                      </div>
                                      <div className="space-y-1">
                                        {sprintSteps.map((step) => (
                                          <div
                                            key={step.id}
                                            className={`flex items-center justify-between p-2 rounded text-xs ${
                                              step.isCompleted ? "bg-green-50 dark:bg-green-950/20" : "bg-background"
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 flex-1">
                                              <button
                                                onClick={() => handleToggleStepComplete(step)}
                                                className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                                  step.isCompleted ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
                                                }`}
                                              >
                                                {step.isCompleted && <Check className="h-3 w-3" />}
                                              </button>
                                              <div className="flex flex-col">
                                                <span className={step.isCompleted ? "line-through text-muted-foreground" : ""}>
                                                  {step.title}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                  z: {step.parentGoalTitle}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5"
                                                onClick={() => handleEditStep(step)}
                                              >
                                                <Pencil className="h-2.5 w-2.5" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Sprint goals by category */}
                                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    {strategicCategories.map((category) => (
                                      <CategoryTemplate
                                        key={category.id}
                                        category={category}
                                        periodId={period.id}
                                        sprintId={sprint.id}
                                        categoryGoals={getGoalsForCategory(category.id, period.id, sprint.id)}
                                        inputValue={templateInputs[`sprint-${sprint.id}-${category.id}`] || ""}
                                        onInputChange={handleInputChange}
                                        onSave={handleSaveFromTemplate}
                                        onToggleComplete={handleToggleComplete}
                                        onDelete={handleDelete}
                                        onEdit={handleEdit}
                                        onPlanWithAI={handlePlanWithAI}
                                        editingGoalId={editingGoalId}
                                        editingTitle={editingTitle}
                                        setEditingTitle={setEditingTitle}
                                        onSaveEdit={handleSaveEdit}
                                        onCancelEdit={handleCancelEdit}
                                        stepsMap={stepsMap}
                                        onToggleStepComplete={handleToggleStepComplete}
                                        onPromoteToSprint={handlePromoteToSprint}
                                        onEditStep={handleEditStep}
                                        onSaveStepEdit={handleSaveStepEdit}
                                        onCancelStepEdit={handleCancelStepEdit}
                                        onDeleteStep={handleDeleteStep}
                                        editingStepId={editingStepId}
                                        editingStepTitle={editingStepTitle}
                                        setEditingStepTitle={setEditingStepTitle}
                                        sprints={allSprints}
                                        tasksMap={tasksMap}
                                        onScheduleTask={(task, goalId) => {
                                          setSchedulingTask(task)
                                          setSchedulingGoalId(goalId)
                                          setScheduleDate(task.scheduledDate || format(new Date(), "yyyy-MM-dd"))
                                        }}
                                        onCompleteTask={handleCompleteTask}
                                        onTaskSubtasksChange={handleTaskSubtasksChange}
                                        onRefreshTasks={refreshGoalTasks}
                                        expandedTaskId={expandedTaskId}
                                        onExpandTask={setExpandedTaskId}
                                        onEditTask={handleEditTask}
                                        onSaveTaskEdit={handleSaveTaskEdit}
                                        onCancelTaskEdit={handleCancelTaskEdit}
                                        editingTaskId={editingTaskId}
                                        editingTaskTitle={editingTaskTitle}
                                        setEditingTaskTitle={setEditingTaskTitle}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )
      })}

      {/* Empty state - no periods */}
      {periods.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak okresów</h3>
            <p className="text-muted-foreground text-center mb-4">
              Stwórz najpierw okres w zakładce Sprinty, aby móc dodawać cele
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Planning Dialog */}
      <Dialog open={!!aiPlanningGoal} onOpenChange={(open) => !open && setAiPlanningGoal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {aiPlanningGoal?.stage === "planning_steps"
                ? "Planowanie kroków realizacji"
                : "Rozbijanie na zadania"}
            </DialogTitle>
            <DialogDescription>
              Cel: <span className="font-medium">{aiPlanningGoal?.goal.title}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto space-y-3 py-4 min-h-[200px] max-h-[300px]">
            {aiHistory.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                {aiPlanningGoal?.stage === "planning_steps"
                  ? "Opisz cel i porozmawiaj z AI, aby wspólnie zaplanować kroki realizacji."
                  : "Porozmawiaj z AI, aby rozbić cel na konkretne zadania do wykonania."}
              </div>
            )}
            {aiHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                  <span className="animate-pulse">AI pisze...</span>
                </div>
              </div>
            )}
          </div>

          {/* Proposed steps preview */}
          {proposedSteps.length > 0 && (
            <div className="border rounded-lg p-3 bg-purple-50 dark:bg-purple-950/20">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                Proponowane kroki ({proposedSteps.length})
              </div>
              <div className="space-y-1">
                {proposedSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span>{step.title}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full mt-3"
                onClick={handleSaveSteps}
              >
                <Check className="h-4 w-4 mr-2" />
                Zatwierdź i zapisz kroki
              </Button>
            </div>
          )}

          {/* Proposed tasks preview */}
          {proposedTasks.length > 0 && (
            <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950/20">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                Proponowane zadania ({proposedTasks.length})
              </div>
              <div className="space-y-1">
                {proposedTasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span>{task.title}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full mt-3"
                onClick={handleSaveTasks}
              >
                <Check className="h-4 w-4 mr-2" />
                Dodaj do harmonogramu
              </Button>
            </div>
          )}

          {/* Save to knowledge section */}
          {knowledgeStep === "generating" && (
            <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20 text-center text-sm">
              <span className="animate-pulse">Tworzę podsumowanie...</span>
            </div>
          )}

          {knowledgeStep === "review" && (
            <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20 space-y-3">
              <div className="text-sm font-medium flex items-center gap-2">
                <BookmarkPlus className="h-4 w-4" />
                Zapisz do bazy wiedzy
              </div>
              <div className="space-y-2">
                <Textarea
                  value={knowledgeForm.content}
                  onChange={(e) => setKnowledgeForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Treść do zapisania..."
                  className="min-h-[80px] text-sm"
                />
                <div>
                  <Label className="text-xs">Kategoria</Label>
                  <select
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background mt-1"
                    value={knowledgeForm.categoryId}
                    onChange={(e) => setKnowledgeForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  >
                    <option value="">Wybierz kategorię...</option>
                    {knowledgeCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveKnowledge} disabled={!knowledgeForm.content.trim() || !knowledgeForm.categoryId}>
                  <Check className="h-3 w-3 mr-1" /> Zapisz
                </Button>
                <Button size="sm" variant="outline" onClick={() => setKnowledgeStep("idle")}>
                  Anuluj
                </Button>
              </div>
            </div>
          )}

          {knowledgeStep === "saving" && (
            <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20 text-center text-sm">
              <span className="animate-pulse">Zapisuję...</span>
            </div>
          )}

          {knowledgeStep === "saved" && (
            <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950/20 text-center text-sm text-green-600">
              Zapisano do bazy wiedzy!
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder={
                aiPlanningGoal?.stage === "planning_steps"
                  ? "Opisz cel lub poproś o propozycję kroków..."
                  : "Opisz lub poproś o propozycję zadań..."
              }
              value={aiMessage}
              onChange={(e) => setAiMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendAiMessage()
                }
              }}
              disabled={aiLoading || knowledgeStep !== "idle"}
            />
            <Button onClick={handleSendAiMessage} disabled={aiLoading || !aiMessage.trim() || knowledgeStep !== "idle"}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            {aiHistory.length > 0 && knowledgeStep === "idle" && (
              <Button variant="outline" onClick={handleStartSaveKnowledge} title="Zapisz do bazy wiedzy">
                <BookmarkPlus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Task Dialog */}
      <Dialog open={!!schedulingTask} onOpenChange={(open) => !open && setSchedulingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Zaplanuj zadanie
            </DialogTitle>
            <DialogDescription>
              Wybierz datę, na którą chcesz zaplanować to zadanie
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">{schedulingTask?.title}</div>
              {schedulingTask?.description && (
                <p className="text-sm text-muted-foreground mt-1">{schedulingTask.description}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Data wykonania</label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSchedulingTask(null)}>
              Anuluj
            </Button>
            <Button onClick={handleScheduleTask}>
              <Calendar className="h-4 w-4 mr-2" />
              Zaplanuj
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
