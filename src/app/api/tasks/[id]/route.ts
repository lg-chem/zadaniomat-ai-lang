import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { updateGoalProgressFromTasks } from "@/lib/goal-progress"

// Helper function to check if user can access a task (owner, assigned, or team admin)
async function canAccessTask(taskId: string, userId: string) {
  // First check if user owns or is assigned to the task
  const ownTask = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [
        { userId },
        { assignedToId: userId }
      ]
    },
    include: {
      organization: { select: { ownerId: true } }
    }
  })
  if (ownTask) return { task: ownTask, isOwner: ownTask.userId === userId, isAssignee: ownTask.assignedToId === userId, isTeamAdmin: false }

  // Check if user is team owner and task belongs to their team member
  const task = await prisma.task.findFirst({
    where: { id: taskId },
    include: {
      organization: { select: { ownerId: true } }
    }
  })
  if (!task) return null

  // Check if task owner is a member of a team where current user is OWNER
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: task.userId,
      role: "MEMBER",
      organization: {
        ownerId: userId,
      },
    },
  })

  if (membership) return { task, isOwner: false, isAssignee: false, isTeamAdmin: true }
  return null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check access (owner, assigned, or team admin)
    const access = await canAccessTask(id, session.user.id)

    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Get full task details
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        category: true,
        timeEntries: true,
        subTasks: true,
        subtasks: {
          orderBy: { order: "asc" },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, image: true }
        },
        user: {
          select: { id: true, name: true, email: true }
        },
        organization: {
          select: { id: true, name: true }
        }
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...task,
      isOwner: access.isOwner || access.isTeamAdmin,
      isAssignee: access.isAssignee
    })
  } catch (error) {
    console.error("Error fetching task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    // Check access (owner, assigned, or team admin)
    const access = await canAccessTask(id, session.user.id)

    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const existingTask = access.task
    const isOwner = access.isOwner || access.isTeamAdmin
    const isAssignee = access.isAssignee

    const {
      title,
      description,
      status,
      categoryId,
      scheduledDate,
      scheduledTime,
      plannedMinutes,
      actualMinutes,
      priority,
      orderInDay,
      goalId,
      sprintId,
      isRecurring,
      recurrenceRule,
      assignedToId,
    } = body

    const updateData: Record<string, unknown> = {}

    // Assignees can only update certain fields
    if (isAssignee && !isOwner) {
      // Assignees can update: status, actualMinutes, scheduledDate, description (for notes)
      if (status !== undefined) {
        updateData.status = status
        if (status === "COMPLETED" && !existingTask.completedAt) {
          updateData.completedAt = new Date()

          // Notify owner when assignee completes the task
          if (existingTask.userId !== session.user.id) {
            await prisma.notification.create({
              data: {
                userId: existingTask.userId,
                type: "TASK_COMPLETED",
                title: "Zadanie ukończone",
                message: `Zadanie "${existingTask.title}" zostało ukończone`,
                metadata: { taskId: id }
              }
            })
          }
        }
      }
      if (actualMinutes !== undefined) updateData.actualMinutes = actualMinutes
      if (description !== undefined) updateData.description = description
      // Allow assignees to schedule tasks in their own harmonogram
      if (scheduledDate !== undefined)
        updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null
      if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime
    } else {
      // Owners can update everything
      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (status !== undefined) {
        updateData.status = status
        if (status === "COMPLETED" && !existingTask.completedAt) {
          updateData.completedAt = new Date()
        }
      }
      if (categoryId !== undefined) updateData.categoryId = categoryId
      if (scheduledDate !== undefined)
        updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null
      if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime
      if (plannedMinutes !== undefined) updateData.plannedMinutes = plannedMinutes
      if (actualMinutes !== undefined) updateData.actualMinutes = actualMinutes
      if (priority !== undefined) updateData.priority = priority
      if (orderInDay !== undefined) updateData.orderInDay = orderInDay
      if (goalId !== undefined) updateData.goalId = goalId
      if (sprintId !== undefined) updateData.sprintId = sprintId
      if (isRecurring !== undefined) updateData.isRecurring = isRecurring
      if (recurrenceRule !== undefined) updateData.recurrenceRule = recurrenceRule
      if (assignedToId !== undefined) {
        updateData.assignedToId = assignedToId

        // Notify new assignee
        if (assignedToId && assignedToId !== existingTask.assignedToId && assignedToId !== session.user.id) {
          await prisma.notification.create({
            data: {
              userId: assignedToId,
              type: "TASK_ASSIGNED",
              title: "Nowe zadanie przydzielone",
              message: `Otrzymałeś zadanie: "${existingTask.title}"`,
              metadata: { taskId: id }
            }
          })
        }
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        subtasks: {
          orderBy: { order: "asc" },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, image: true }
        },
        organization: {
          select: { id: true, name: true }
        }
      },
    })

    // Sync goal progress when task status changes
    if (status !== undefined && existingTask.goalId) {
      await updateGoalProgressFromTasks(existingTask.goalId)
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check access (owner, assigned, or team admin)
    const access = await canAccessTask(id, session.user.id)

    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const existingTask = access.task
    const isOwner = access.isOwner || access.isTeamAdmin
    const isAssignee = access.isAssignee

    // If assignee (not owner/team admin) is deleting, notify the owner
    if (isAssignee && !isOwner) {
      await prisma.notification.create({
        data: {
          userId: existingTask.userId,
          type: "TASK_DELETED",
          title: "Zadanie usunięte",
          message: `Zadanie "${existingTask.title}" zostało usunięte przez przydzielonego pracownika`,
          metadata: {
            taskTitle: existingTask.title,
            deletedBy: session.user.id
          }
        }
      })
    }

    await prisma.task.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
