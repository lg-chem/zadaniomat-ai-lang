import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { setKeyResultValue } from "@/lib/quarter-data"
import { goalInputSchema, ownedCategoryId } from "@/lib/quarter-schemas"

const updateGoalSchema = goalInputSchema.partial().extend({
  isCompleted: z.boolean().optional(),
})

async function findOwnedGoal(userId: string, id: string) {
  return prisma.goal.findFirst({
    where: { id, userId, kind: "QUARTER" },
    include: { keyResults: true },
  })
}

// Update a quarterly goal; keyResults (when sent) replace the current list
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const goal = await findOwnedGoal(userId, params.id)
    if (!goal) {
      return NextResponse.json({ error: "Cel nie znaleziony" }, { status: 404 })
    }

    const parsed = updateGoalSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane celu" }, { status: 400 })
    }
    const input = parsed.data

    const data: Record<string, unknown> = {}
    if (input.title !== undefined) data.title = input.title
    if (input.why !== undefined) data.why = input.why
    if (input.obstacle !== undefined) data.obstacle = input.obstacle
    if (input.ifThenPlan !== undefined) data.ifThenPlan = input.ifThenPlan
    if (input.leadMeasure !== undefined) data.leadMeasure = input.leadMeasure
    if (input.leadTarget !== undefined) data.leadTarget = input.leadTarget
    if (input.leadMeasure === null) data.leadTarget = null
    if (input.isCompleted !== undefined) data.isCompleted = input.isCompleted
    if (input.categoryId !== undefined) data.categoryId = await ownedCategoryId(userId, input.categoryId)

    await prisma.$transaction(async (tx) => {
      await tx.goal.update({ where: { id: goal.id }, data })

      if (input.keyResults) {
        const existingById = new Map(goal.keyResults.map((kr) => [kr.id, kr]))
        const keptIds = new Set<string>()

        for (const [index, kr] of input.keyResults.entries()) {
          const existing = kr.id ? existingById.get(kr.id) : undefined
          if (existing) {
            keptIds.add(existing.id)
            await tx.keyResult.update({
              where: { id: existing.id },
              data: {
                title: kr.title,
                unit: kr.unit,
                startValue: kr.startValue,
                targetValue: kr.targetValue,
                order: index,
              },
            })
            if (kr.currentValue !== undefined) {
              await setKeyResultValue(tx, existing, kr.currentValue)
            }
          } else {
            const currentValue = kr.currentValue ?? kr.startValue
            await tx.keyResult.create({
              data: {
                goalId: goal.id,
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
        }

        const removedIds = goal.keyResults.filter((kr) => !keptIds.has(kr.id)).map((kr) => kr.id)
        if (removedIds.length > 0) {
          await tx.keyResult.deleteMany({ where: { id: { in: removedIds } } })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating quarter goal:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Delete a quarterly goal together with its key results, check-ins and sprint commitments
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const goal = await findOwnedGoal(session.user.id, params.id)
    if (!goal) {
      return NextResponse.json({ error: "Cel nie znaleziony" }, { status: 404 })
    }

    await prisma.goal.delete({ where: { id: goal.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting quarter goal:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
