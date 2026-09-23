import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { ensureQuarter, findOwnedQuarter } from "@/lib/quarter-data"
import { shiftQuarter } from "@/lib/quarters"

const reviewSchema = z.object({
  reviewNotes: z.string().trim().max(8000).default(""),
  goals: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(1).nullish(),
      reviewNote: z.string().trim().max(2000).nullish(),
      carryOver: z.boolean().default(false),
    })
  ),
})

// Quarter review: score each goal, write lessons, carry unfinished goals to the next quarter
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

    const period = await findOwnedQuarter(userId, params.id)
    if (!period || period.year === null || period.quarter === null) {
      return NextResponse.json({ error: "Kwartał nie znaleziony" }, { status: 404 })
    }

    const parsed = reviewSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane przeglądu" }, { status: 400 })
    }

    const goals = await prisma.goal.findMany({
      where: { id: { in: parsed.data.goals.map((g) => g.id) }, userId, periodId: period.id, kind: "QUARTER" },
      include: { keyResults: { orderBy: { order: "asc" } } },
    })
    const goalsById = new Map(goals.map((g) => [g.id, g]))

    const toCarry = parsed.data.goals.filter((g) => {
      const goal = goalsById.get(g.id)
      return g.carryOver && goal && !goal.carriedOver
    })
    const nextQuarter = toCarry.length > 0
      ? await ensureQuarter(userId, shiftQuarter({ year: period.year, quarter: period.quarter }, 1))
      : null
    let nextOrder = nextQuarter
      ? await prisma.goal.count({ where: { userId, periodId: nextQuarter.id, kind: "QUARTER" } })
      : 0

    await prisma.$transaction(async (tx) => {
      for (const item of parsed.data.goals) {
        const goal = goalsById.get(item.id)
        if (!goal) continue

        const carry = nextQuarter !== null && toCarry.includes(item)
        await tx.goal.update({
          where: { id: goal.id },
          data: {
            score: item.score ?? null,
            reviewNote: item.reviewNote || null,
            carriedOver: goal.carriedOver || carry,
          },
        })

        if (carry && nextQuarter) {
          await tx.goal.create({
            data: {
              title: goal.title,
              why: goal.why,
              obstacle: goal.obstacle,
              ifThenPlan: goal.ifThenPlan,
              leadMeasure: goal.leadMeasure,
              leadTarget: goal.leadTarget,
              categoryId: goal.categoryId,
              kind: "QUARTER",
              order: nextOrder++,
              workspaceType: "WORK",
              periodId: nextQuarter.id,
              userId,
              // Continue from where the goal ended
              keyResults: {
                create: goal.keyResults.map((kr) => ({
                  title: kr.title,
                  unit: kr.unit,
                  startValue: kr.currentValue,
                  targetValue: kr.targetValue,
                  currentValue: kr.currentValue,
                  order: kr.order,
                  entries: { create: { value: kr.currentValue } },
                })),
              },
            },
          })
        }
      }

      await tx.period.update({
        where: { id: period.id },
        data: { reviewNotes: parsed.data.reviewNotes || null, reviewedAt: new Date() },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving quarter review:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
