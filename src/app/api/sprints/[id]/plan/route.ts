import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

const planSchema = z.object({
  sprintGoal: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
  commitments: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().trim().min(1).max(300),
        parentGoalId: z.string().nullish(),
      })
    )
    .max(20),
})

// Sprint planning: sprint goal + commitments linked to quarterly goals (replaces the list)
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const sprint = await prisma.sprint.findFirst({
      where: { id: params.id, period: { userId, workspaceType: "WORK", year: { not: null } } },
    })
    if (!sprint) {
      return NextResponse.json({ error: "Sprint nie znaleziony" }, { status: 404 })
    }

    const parsed = planSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowy plan sprintu" }, { status: 400 })
    }

    const [quarterGoals, existing] = await Promise.all([
      prisma.goal.findMany({
        where: { userId, periodId: sprint.periodId, kind: "QUARTER" },
        select: { id: true, categoryId: true },
      }),
      prisma.goal.findMany({
        where: { userId, sprintId: sprint.id },
        select: { id: true },
      }),
    ])
    const parentsById = new Map(quarterGoals.map((g) => [g.id, g]))
    const existingIds = new Set(existing.map((g) => g.id))
    const keptIds = new Set<string>()

    await prisma.$transaction(async (tx) => {
      await tx.sprint.update({
        where: { id: sprint.id },
        data: { sprintGoal: parsed.data.sprintGoal, plannedAt: sprint.plannedAt ?? new Date() },
      })

      for (const [index, item] of parsed.data.commitments.entries()) {
        const parent = item.parentGoalId ? parentsById.get(item.parentGoalId) : undefined
        const data = {
          title: item.title,
          parentGoalId: parent?.id ?? null,
          categoryId: parent?.categoryId ?? null,
          order: index,
        }

        if (item.id && existingIds.has(item.id)) {
          keptIds.add(item.id)
          await tx.goal.update({ where: { id: item.id }, data })
        } else {
          await tx.goal.create({
            data: {
              ...data,
              kind: "COMMITMENT",
              workspaceType: "WORK",
              periodId: sprint.periodId,
              sprintId: sprint.id,
              userId,
            },
          })
        }
      }

      const removedIds = Array.from(existingIds).filter((id) => !keptIds.has(id))
      if (removedIds.length > 0) {
        await tx.goal.deleteMany({ where: { id: { in: removedIds }, userId } })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error planning sprint:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
