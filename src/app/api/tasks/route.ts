import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") || "WORK"
    const date = searchParams.get("date")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
    const categoryId = searchParams.get("categoryId")
    const includeAssigned = searchParams.get("includeAssigned") === "true"
    const assignedOnly = searchParams.get("assignedOnly") === "true"
    const organizationId = searchParams.get("organizationId")

    // Base filters
    const baseFilters: Record<string, unknown> = {
      workspaceType: workspace,
    }

    if (date) {
      baseFilters.scheduledDate = new Date(date)
    } else if (startDate && endDate) {
      baseFilters.scheduledDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    if (status) {
      baseFilters.status = status
    }

    if (categoryId) {
      baseFilters.categoryId = categoryId
    }

    if (organizationId) {
      baseFilters.organizationId = organizationId
    }

    // Build where clause based on mode
    let where: Record<string, unknown>

    if (assignedOnly) {
      // Only tasks assigned to this user (team tasks)
      where = {
        ...baseFilters,
        assignedToId: session.user.id,
      }
    } else if (includeAssigned) {
      // User's own tasks OR tasks assigned to them
      where = {
        ...baseFilters,
        OR: [
          { userId: session.user.id },
          { assignedToId: session.user.id }
        ]
      }
    } else {
      // Default: only user's own tasks
      where = {
        ...baseFilters,
        userId: session.user.id,
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        category: true,
        goal: {
          select: { id: true, title: true },
        },
        timeEntries: {
          orderBy: { startTime: "desc" },
          take: 5,
        },
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
      orderBy: [
        { scheduledTime: "asc" },
        { orderInDay: "asc" },
        { createdAt: "desc" },
      ],
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      title,
      description,
      categoryId,
      scheduledDate,
      scheduledTime,
      plannedMinutes,
      priority,
      workspaceType = "WORK",
      goalId,
      sprintId,
      orderInDay,
      status,
      isRecurring,
      recurrenceRule,
      assignedToId,
      organizationId,
    } = body

    if (!title) {
      return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 })
    }

    // If assigning to someone, verify organization membership
    if (assignedToId && organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          ownerId: true,
          members: { select: { userId: true } }
        }
      })

      if (!organization) {
        return NextResponse.json({ error: "Zespół nie znaleziony" }, { status: 404 })
      }

      // Check if current user is owner or member
      const isOwner = organization.ownerId === session.user.id
      const isCurrentUserMember = organization.members.some(m => m.userId === session.user.id)

      if (!isOwner && !isCurrentUserMember) {
        return NextResponse.json({ error: "Nie jesteś członkiem tego zespołu" }, { status: 403 })
      }

      // Check if assignee is a member (or owner)
      const isAssigneeMember = organization.members.some(m => m.userId === assignedToId)
      const isAssigneeOwner = organization.ownerId === assignedToId
      if (!isAssigneeMember && !isAssigneeOwner) {
        return NextResponse.json({ error: "Użytkownik nie jest członkiem zespołu" }, { status: 400 })
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        categoryId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime,
        plannedMinutes,
        priority: priority || 0,
        workspaceType,
        goalId,
        sprintId,
        orderInDay: orderInDay || 0,
        status: status || "NEW",
        isRecurring: isRecurring || false,
        recurrenceRule: recurrenceRule || null,
        userId: session.user.id,
        assignedToId: assignedToId || null,
        organizationId: organizationId || null,
      },
      include: {
        category: true,
        goal: {
          select: { id: true, title: true },
        },
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

    // Create notification for assigned user
    if (assignedToId && assignedToId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          type: "TASK_ASSIGNED",
          title: "Nowe zadanie przydzielone",
          message: `Otrzymałeś nowe zadanie: "${title}"`,
          metadata: { taskId: task.id, organizationId }
        }
      })
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
