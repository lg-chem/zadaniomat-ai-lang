import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { findOwnedQuarter } from "@/lib/quarter-data"
import { goalInputSchema, ownedCategoryId } from "@/lib/quarter-schemas"

const createGoalSchema = goalInputSchema.extend({
  // Goal from an earlier quarter or legacy period that is continued here
  carriedFromGoalId: z.string().optional(),
})

// Create a quarterly goal with its key results
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
    if (!period) {
      return NextResponse.json({ error: "Kwartał nie znaleziony" }, { status: 404 })
    }

    const parsed = createGoalSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane celu" }, { status: 400 })
    }
    const input = parsed.data
    const categoryId = await ownedCategoryId(userId, input.categoryId)

    const count = await prisma.goal.count({
      where: { userId, periodId: period.id, sprintId: null, parentGoalId: null, isStep: false },
    })

    const goal = await prisma.$transaction(async (tx) => {
      const created = await tx.goal.create({
        data: {
          title: input.title,
          why: input.why,
          obstacle: input.obstacle,
          ifThenPlan: input.ifThenPlan,
          leadMeasure: input.leadMeasure,
          leadTarget: input.leadMeasure ? input.leadTarget : null,
          categoryId,
          kind: "QUARTER",
          order: count,
          workspaceType: "WORK",
          periodId: period.id,
          userId,
        },
      })

      for (const [index, kr] of input.keyResults.entries()) {
        const currentValue = kr.currentValue ?? kr.startValue
        await tx.keyResult.create({
          data: {
            goalId: created.id,
            title: kr.title,
            unit: kr.unit,
            startValue: kr.startValue,
            targetValue: kr.targetValue,
            currentValue,
            order: index,
            entries: { create: { value: currentValue } },
          },
        })
      }

      if (input.carriedFromGoalId) {
        await tx.goal.updateMany({
          where: { id: input.carriedFromGoalId, userId },
          data: { carriedOver: true },
        })
      }

      return created
    })

    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    console.error("Error creating quarter goal:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
