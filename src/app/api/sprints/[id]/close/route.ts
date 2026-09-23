import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

const closeSchema = z.object({
  wentWell: z.string().max(4000).default(""),
  needsImprovement: z.string().max(4000).default(""),
  actionItem: z.string().trim().max(500).default(""),
  completedIds: z.array(z.string()).default([]),
  carryOverIds: z.array(z.string()).default([]),
})

const toLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

// Sprint review + retro: mark commitments, carry unfinished ones to the next sprint, save the retro
export async function POST(
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
      include: {
        goals: {
          where: { userId },
          include: {
            tasks: { where: { status: { notIn: ["COMPLETED", "CANCELLED"] } }, select: { id: true } },
          },
        },
      },
    })
    if (!sprint) {
      return NextResponse.json({ error: "Sprint nie znaleziony" }, { status: 404 })
    }

    const parsed = closeSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane retro" }, { status: 400 })
    }
    const input = parsed.data

    const nextSprint = await prisma.sprint.findFirst({
      where: { periodId: sprint.periodId, startDate: { gt: sprint.startDate } },
      orderBy: { startDate: "asc" },
      include: { goals: { where: { userId }, select: { id: true } } },
    })

    const completedIds = new Set(input.completedIds)
    const carryOverIds = new Set(nextSprint ? input.carryOverIds : [])

    await prisma.$transaction(async (tx) => {
      let nextOrder = nextSprint?.goals.length ?? 0

      for (const commitment of sprint.goals) {
        const isCompleted = completedIds.has(commitment.id)
        // Closing again (to edit the retro) must not copy an already carried commitment twice
        const carry = !isCompleted && !commitment.carriedOver && carryOverIds.has(commitment.id)

        await tx.goal.update({
          where: { id: commitment.id },
          data: { isCompleted, carriedOver: commitment.carriedOver || carry },
        })

        if (carry && nextSprint) {
          const copy = await tx.goal.create({
            data: {
              title: commitment.title,
              kind: "COMMITMENT",
              workspaceType: commitment.workspaceType,
              parentGoalId: commitment.parentGoalId,
              categoryId: commitment.categoryId,
              periodId: sprint.periodId,
              sprintId: nextSprint.id,
              order: nextOrder++,
              userId,
            },
          })
          // Open tasks follow the commitment to the next sprint
          if (commitment.tasks.length > 0) {
            await tx.task.updateMany({
              where: { id: { in: commitment.tasks.map((t) => t.id) } },
              data: { goalId: copy.id },
            })
          }
        }
      }

      const retro = {
        wentWell: toLines(input.wentWell),
        needsImprovement: toLines(input.needsImprovement),
        actionItems: input.actionItem ? [input.actionItem] : [],
      }
      await tx.retrospective.upsert({
        where: { sprintId: sprint.id },
        create: { sprintId: sprint.id, ...retro },
        update: retro,
      })

      await tx.sprint.update({
        where: { id: sprint.id },
        data: { closedAt: new Date() },
      })
    })

    return NextResponse.json({ success: true, nextSprintId: nextSprint?.id ?? null })
  } catch (error) {
    console.error("Error closing sprint:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
