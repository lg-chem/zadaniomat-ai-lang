import { z } from "zod"
import type { Prisma, WorkspaceType } from "@prisma/client"
import prisma from "@/lib/prisma"
import { isValidDay, isValidTime } from "@/lib/calendar"
import { normalizeRichText } from "@/lib/rich-text"
import { ownedCategoryId } from "@/lib/quarter-schemas"

// Task made from a piece of text: a note, a line of it, or a fragment of another task's description

export const taskFromTextSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(500_000).nullish(),
  scheduledDate: z.string().refine(isValidDay).nullish(),
  scheduledTime: z.string().refine(isValidTime).nullish(),
  plannedMinutes: z.number().int().min(1).max(24 * 60).nullish(),
  categoryId: z.string().nullish(),
})

export type TaskFromTextInput = z.infer<typeof taskFromTextSchema>

export async function createTaskFromText(
  userId: string,
  input: TaskFromTextInput,
  // Where the text came from, e.g. { noteId } - the source finds its tasks by it
  source: { workspaceType: WorkspaceType; metadata: Prisma.InputJsonObject }
) {
  const description = normalizeRichText(input.description)

  return prisma.task.create({
    data: {
      title: input.title,
      description,
      descriptionUpdatedAt: description ? new Date() : null,
      scheduledDate: input.scheduledDate ? new Date(`${input.scheduledDate}T00:00:00.000Z`) : null,
      scheduledTime: input.scheduledTime || null,
      plannedMinutes: input.plannedMinutes ?? 25,
      categoryId: await ownedCategoryId(userId, input.categoryId ?? null),
      workspaceType: source.workspaceType,
      status: "NEW",
      metadata: source.metadata,
      userId,
    },
    select: { id: true, title: true, status: true, scheduledDate: true, scheduledTime: true },
  })
}
