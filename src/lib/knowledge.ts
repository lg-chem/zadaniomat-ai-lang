import { z } from "zod"
import type { KnowledgeEntry, Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { updateKnowledgeEmbedding } from "@/lib/embeddings"
import { htmlToPlainText, normalizeRichText } from "@/lib/rich-text"

// Server helpers for knowledge entries (Baza Wiedzy)

const stepSchema = z.object({
  title: z.string().max(300).default(""),
  description: z.string().max(20_000).nullish(),
  estimatedTime: z.number().int().min(0).max(100_000).nullish(),
  assignedRole: z.string().max(100).nullish(),
})

const entryFields = {
  title: z.string().trim().max(300),
  content: z.string().max(500_000).nullish(),
  isImportant: z.boolean(),
  visibility: z.enum(["PRIVATE", "TEAM"]),
  type: z.enum(["ARTICLE", "SOP", "HOWTO", "FAQ", "CHECKLIST", "TEMPLATE"]),
  tags: z.array(z.string().trim().min(1).max(60)).max(40),
  steps: z.array(stepSchema).max(200),
  // Saved while typing - the search index is refreshed when writing ends (reindex)
  autosave: z.boolean(),
}

export const createEntrySchema = z.object({
  // Own id from the device - if the answer gets lost, sending again doesn't make a copy
  id: z.string().regex(/^[a-z0-9]{20,40}$/).optional(),
  categoryId: z.string().min(1),
  workspace: z.enum(["WORK", "PRIVATE"]).optional(),
  title: entryFields.title.optional(),
  content: entryFields.content,
  isImportant: entryFields.isImportant.optional(),
  visibility: entryFields.visibility.optional(),
  type: entryFields.type.optional(),
  tags: entryFields.tags.optional(),
  steps: entryFields.steps.optional(),
  autosave: entryFields.autosave.optional(),
})

export const updateEntrySchema = z.object({
  categoryId: z.string().min(1).optional(),
  title: entryFields.title.optional(),
  content: entryFields.content,
  isImportant: entryFields.isImportant.optional(),
  visibility: entryFields.visibility.optional(),
  type: entryFields.type.optional(),
  tags: entryFields.tags.optional(),
  steps: entryFields.steps.optional(),
  autosave: entryFields.autosave.optional(),
  // false - the same writing session as the last save: the version from its start is enough
  snapshot: z.boolean().optional(),
  // Writing ended - refresh the AI search index
  reindex: z.boolean().optional(),
})

export type EntryStepInput = z.infer<typeof stepSchema>

export const entryInclude = {
  category: true,
  user: { select: { id: true, name: true } },
  steps: { orderBy: { order: "asc" } },
} satisfies Prisma.KnowledgeEntryInclude

// Steps as stored; empty ones (just added, nothing typed yet) are skipped
export function stepRows(steps: EntryStepInput[]) {
  return steps
    .filter((step) => step.title.trim() || step.description?.trim())
    .map((step, index) => ({
      order: index,
      title: step.title.trim(),
      description: step.description?.trim() || null,
      estimatedTime: step.estimatedTime || null,
      assignedRole: step.assignedRole?.trim() || null,
    }))
}

// Text stored for an entry: never null, the column is required
export function entryContent(value: string | null | undefined): string {
  return normalizeRichText(value) ?? ""
}

export function hasEntryText(title: string | undefined, content: string | null | undefined): boolean {
  return !!title?.trim() || !!normalizeRichText(content)
}

// Refreshes the AI search index in the background
export function reindexEntry(entry: Pick<KnowledgeEntry, "id" | "title" | "content">) {
  const text = `${entry.title}\n\n${htmlToPlainText(entry.content)}`.trim()
  if (!text) return
  updateKnowledgeEmbedding(entry.id, text).catch((error) => {
    console.error("Error updating knowledge embedding:", error)
  })
}

export async function ownsKnowledgeCategory(userId: string, categoryId: string) {
  const category = await prisma.knowledgeCategory.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  })
  return !!category
}

// Own entry, or one shared with the team by someone from the same team
export async function findReadableEntry(userId: string, id: string) {
  const entry = await prisma.knowledgeEntry.findUnique({ where: { id } })
  if (!entry) return null
  if (entry.userId === userId) return entry
  if (entry.visibility !== "TEAM") return null

  const sharedTeam = await prisma.organization.findFirst({
    where: {
      AND: [
        { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        { OR: [{ ownerId: entry.userId }, { members: { some: { userId: entry.userId } } }] },
      ],
    },
    select: { id: true },
  })
  return sharedTeam ? entry : null
}
