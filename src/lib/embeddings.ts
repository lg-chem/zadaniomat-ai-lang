import { google } from "@ai-sdk/google"
import { embed, embedMany } from "ai"
import prisma from "./prisma"

// Generate embedding for a single text
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel("text-embedding-004"),
    value: text,
  })
  return embedding
}

// Generate embeddings for multiple texts
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel("text-embedding-004"),
    values: texts,
  })
  return embeddings
}

// Store embedding for a knowledge entry
export async function updateKnowledgeEmbedding(entryId: string, content: string) {
  try {
    const embedding = await generateEmbedding(content)
    const embeddingStr = `[${embedding.join(",")}]`

    await prisma.$executeRaw`
      UPDATE "KnowledgeEntry"
      SET "embedding" = ${embeddingStr}::vector
      WHERE "id" = ${entryId}
    `
    return true
  } catch (error) {
    console.error("Error updating knowledge embedding:", error)
    return false
  }
}

// Store embedding for a conversation
export async function updateConversationEmbedding(conversationId: string, summary: string) {
  try {
    const embedding = await generateEmbedding(summary)
    const embeddingStr = `[${embedding.join(",")}]`

    await prisma.$executeRaw`
      UPDATE "AIConversation"
      SET "embedding" = ${embeddingStr}::vector
      WHERE "id" = ${conversationId}
    `
    return true
  } catch (error) {
    console.error("Error updating conversation embedding:", error)
    return false
  }
}

// Semantic search in knowledge base
export async function searchKnowledge(
  query: string,
  userId: string,
  options: {
    limit?: number
    workspaceType?: "WORK" | "PRIVATE"
    includeTeamKnowledge?: boolean
    teamCategoryIds?: string[]
  } = {}
) {
  const { limit = 10, workspaceType = "WORK", includeTeamKnowledge = true, teamCategoryIds = [] } = options

  try {
    const queryEmbedding = await generateEmbedding(query)
    const embeddingStr = `[${queryEmbedding.join(",")}]`

    // Build the WHERE clause for team knowledge
    let teamCondition = ""
    if (includeTeamKnowledge && teamCategoryIds.length > 0) {
      const teamIds = teamCategoryIds.map(id => `'${id}'`).join(",")
      teamCondition = `OR ("visibility" = 'TEAM' AND "categoryId" IN (${teamIds}))`
    }

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string
      title: string
      content: string
      similarity: number
      categoryId: string
      userId: string
    }>>(
      `SELECT
        id,
        title,
        content,
        "categoryId",
        "userId",
        1 - ("embedding" <=> '${embeddingStr}'::vector) as similarity
      FROM "KnowledgeEntry"
      WHERE "embedding" IS NOT NULL
        AND "workspaceType" = '${workspaceType}'
        AND ("userId" = '${userId}' ${teamCondition})
      ORDER BY "embedding" <=> '${embeddingStr}'::vector
      LIMIT ${limit}`
    )

    return results
  } catch (error) {
    console.error("Error in semantic search:", error)
    return []
  }
}

// Search in past conversations
export async function searchConversations(
  query: string,
  userId: string,
  options: { limit?: number } = {}
) {
  const { limit = 5 } = options

  try {
    const queryEmbedding = await generateEmbedding(query)
    const embeddingStr = `[${queryEmbedding.join(",")}]`

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string
      title: string
      summary: string
      similarity: number
    }>>(
      `SELECT
        id,
        title,
        summary,
        1 - ("embedding" <=> '${embeddingStr}'::vector) as similarity
      FROM "AIConversation"
      WHERE "embedding" IS NOT NULL
        AND "userId" = '${userId}'
      ORDER BY "embedding" <=> '${embeddingStr}'::vector
      LIMIT ${limit}`
    )

    return results
  } catch (error) {
    console.error("Error searching conversations:", error)
    return []
  }
}
