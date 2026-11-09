import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { noteTitleFrom } from "@/lib/rich-text"
import type { GoalTaskItem } from "@/lib/quarters"

// Server-only: tasks of quarter goals and sprint commitments in the goals page format

export const goalTaskSelect = {
  id: true,
  title: true,
  status: true,
  description: true,
  scheduledDate: true,
  scheduledTime: true,
  plannedMinutes: true,
  goalId: true,
  metadata: true,
  subtasks: {
    orderBy: { order: "asc" },
    select: { id: true, title: true, isCompleted: true, order: true },
  },
} satisfies Prisma.TaskSelect

/** Note from Notatki the task is linked to (made from it, or pinned to it) */
export function linkedNoteId(metadata: Prisma.JsonValue | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const id = (metadata as Prisma.JsonObject).noteId
  return typeof id === "string" ? id : null
}

/** Replaces metadata with the linked note's id and title (only the user's own notes) */
export async function withLinkedNotes<T extends { metadata: Prisma.JsonValue | null }>(
  userId: string,
  tasks: T[]
): Promise<(Omit<T, "metadata"> & { linkedNote: GoalTaskItem["linkedNote"] })[]> {
  const ids = Array.from(new Set(tasks.map((t) => linkedNoteId(t.metadata)).filter((id): id is string => !!id)))
  const notes =
    ids.length > 0
      ? await prisma.note.findMany({ where: { id: { in: ids }, userId }, select: { id: true, title: true, content: true } })
      : []
  const byId = new Map(notes.map((n) => [n.id, { id: n.id, title: noteTitleFrom(n.title, n.content) }]))

  return tasks.map(({ metadata, ...task }) => ({
    ...task,
    linkedNote: byId.get(linkedNoteId(metadata) ?? "") ?? null,
  }))
}
