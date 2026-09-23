import { z } from "zod"
import prisma from "@/lib/prisma"

// Request validation for the quarterly goals API

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

export const keyResultInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  unit: optionalText(40),
  startValue: z.number(),
  targetValue: z.number(),
  currentValue: z.number().optional(),
})

export const goalInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  why: optionalText(2000),
  obstacle: optionalText(2000),
  ifThenPlan: optionalText(2000),
  leadMeasure: optionalText(200),
  leadTarget: z.number().positive().nullish().transform((v) => v ?? null),
  categoryId: z.string().nullish().transform((v) => v || null),
  keyResults: z.array(keyResultInputSchema).max(5),
})

export type GoalInput = z.infer<typeof goalInputSchema>

/** Category id if it belongs to the user, otherwise null */
export async function ownedCategoryId(userId: string, categoryId: string | null) {
  if (!categoryId) return null
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  })
  return category?.id ?? null
}
