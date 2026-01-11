import prisma from "@/lib/prisma"

/**
 * Updates goal progress based on its linked tasks
 * Cascades up to parent goal if this goal is a step
 */
export async function updateGoalProgressFromTasks(goalId: string): Promise<void> {
  // Get goal with its tasks
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      tasks: {
        where: {
          status: { not: "CANCELLED" },
        },
        select: { id: true, status: true },
      },
    },
  })

  if (!goal) return

  const totalTasks = goal.tasks.length
  const completedTasks = goal.tasks.filter(t => t.status === "COMPLETED").length

  // Update goal progress
  const updateData: {
    currentValue: number
    targetValue?: number
    unit?: string
    isCompleted?: boolean
  } = {
    currentValue: completedTasks,
  }

  // Set targetValue if not already set or if it's task-based
  if (!goal.targetValue || goal.unit === "zadań") {
    updateData.targetValue = totalTasks
    updateData.unit = "zadań"
  }

  // Auto-complete goal when all tasks are done (only if has tasks)
  if (totalTasks > 0 && completedTasks === totalTasks) {
    updateData.isCompleted = true
  }

  await prisma.goal.update({
    where: { id: goalId },
    data: updateData,
  })

  // If this goal is a step (child goal), update parent goal's progress
  if (goal.parentGoalId) {
    await updateParentGoalProgress(goal.parentGoalId)
  }
}

/**
 * Updates parent goal progress based on completed child goals (steps)
 */
export async function updateParentGoalProgress(parentGoalId: string): Promise<void> {
  // Get all child goals (steps)
  const childGoals = await prisma.goal.findMany({
    where: {
      parentGoalId,
      isStep: true,
    },
    select: { id: true, isCompleted: true },
  })

  if (childGoals.length === 0) return

  const totalSteps = childGoals.length
  const completedSteps = childGoals.filter(g => g.isCompleted).length

  await prisma.goal.update({
    where: { id: parentGoalId },
    data: {
      currentValue: completedSteps,
      targetValue: totalSteps,
      unit: "kroków",
      // Don't auto-complete parent - let user decide
    },
  })
}

/**
 * Recalculates progress for a goal and all its ancestors
 * Call this when goals are modified directly
 */
export async function recalculateGoalProgress(goalId: string): Promise<void> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { id: true, parentGoalId: true, isStep: true },
  })

  if (!goal) return

  // Update this goal's progress from its tasks
  await updateGoalProgressFromTasks(goalId)

  // If this is a step, update parent too
  if (goal.parentGoalId) {
    await updateParentGoalProgress(goal.parentGoalId)
  }
}

/**
 * Promotes a step to become a sprint goal
 * Links it to a sprint while keeping parent relationship
 */
export async function promoteStepToSprintGoal(
  stepId: string,
  sprintId: string
): Promise<{ success: boolean; goal?: unknown; error?: string }> {
  const step = await prisma.goal.findUnique({
    where: { id: stepId },
    include: { parentGoal: true },
  })

  if (!step) {
    return { success: false, error: "Step not found" }
  }

  if (!step.isStep) {
    return { success: false, error: "Goal is not a step" }
  }

  // Verify sprint exists and belongs to the same period
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { period: true },
  })

  if (!sprint) {
    return { success: false, error: "Sprint not found" }
  }

  // Update step to link to sprint
  const updatedGoal = await prisma.goal.update({
    where: { id: stepId },
    data: {
      sprintId: sprintId,
    },
    include: {
      category: true,
      sprint: true,
      parentGoal: true,
    },
  })

  return { success: true, goal: updatedGoal }
}
