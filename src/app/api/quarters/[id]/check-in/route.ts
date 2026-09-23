import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { findOwnedQuarter, setKeyResultValue } from "@/lib/quarter-data"
import { dayKeyToDate, isDayKey, weekStartKey } from "@/lib/quarters"

const checkInSchema = z.object({
  // User's local date - the check-in belongs to the week (Monday) of this day
  today: z.string().refine(isDayKey),
  items: z.array(
    z.object({
      goalId: z.string(),
      confidence: z.number().int().min(1).max(10).nullish(),
      leadActual: z.number().min(0).nullish(),
      note: z.string().trim().max(2000).nullish(),
      keyResults: z.array(z.object({ id: z.string(), currentValue: z.number() })).default([]),
    })
  ),
})

// Weekly check-in: key result values, lead measure and confidence per goal
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

    const parsed = checkInSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane check-inu" }, { status: 400 })
    }
    const weekStart = dayKeyToDate(weekStartKey(parsed.data.today))

    const goals = await prisma.goal.findMany({
      where: {
        id: { in: parsed.data.items.map((i) => i.goalId) },
        userId,
        periodId: period.id,
      },
      include: { keyResults: true },
    })
    const goalsById = new Map(goals.map((g) => [g.id, g]))

    await prisma.$transaction(async (tx) => {
      for (const item of parsed.data.items) {
        const goal = goalsById.get(item.goalId)
        if (!goal) continue

        const values = {
          confidence: item.confidence ?? null,
          leadActual: item.leadActual ?? null,
          note: item.note || null,
        }
        await tx.goalCheckIn.upsert({
          where: { goalId_weekStart: { goalId: goal.id, weekStart } },
          create: { goalId: goal.id, weekStart, ...values },
          update: values,
        })

        for (const krInput of item.keyResults) {
          const keyResult = goal.keyResults.find((kr) => kr.id === krInput.id)
          if (keyResult) await setKeyResultValue(tx, keyResult, krInput.currentValue)
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving check-in:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
