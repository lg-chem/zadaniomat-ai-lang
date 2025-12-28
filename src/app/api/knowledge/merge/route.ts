import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { categoryId, newInfo, workspace, title } = body

    if (!categoryId || !newInfo) {
      return NextResponse.json(
        { error: "categoryId i newInfo są wymagane" },
        { status: 400 }
      )
    }

    // Verify category belongs to user
    const category = await prisma.knowledgeCategory.findFirst({
      where: {
        id: categoryId,
        userId: session.user.id,
      },
    })

    if (!category) {
      return NextResponse.json({ error: "Kategoria nie znaleziona" }, { status: 404 })
    }

    // Try AI-powered merge, but fall back to simple create if AI fails
    let entry = null
    let action = "create"
    let reason = "Zapisano nową informację"

    // Check if GEMINI_API_KEY is configured
    if (process.env.GEMINI_API_KEY) {
      try {
        // Get existing entries in this category
        const existingEntries = await prisma.knowledgeEntry.findMany({
          where: {
            categoryId,
            userId: session.user.id,
          },
          select: {
            id: true,
            title: true,
            content: true,
          },
        })

        // Build context of existing knowledge
        const existingKnowledge = existingEntries.map((e: { id: string; title: string; content: string }) =>
          `## ${e.title}\n${e.content}`
        ).join("\n\n")

        // Use AI to determine how to merge
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

        const prompt = `Jesteś asystentem zarządzającym bazą wiedzy firmowej/osobistej.

ISTNIEJĄCA WIEDZA w kategorii "${category.name}":
${existingKnowledge || "(brak wpisów)"}

NOWA INFORMACJA do dodania:
${newInfo}

Twoim zadaniem jest:
1. Przeanalizować czy nowa informacja jest już zawarta w istniejącej wiedzy
2. Jeśli jest nowa - zaproponuj NOWY WPIS z tytułem i treścią
3. Jeśli aktualizuje istniejący wpis - zaproponuj AKTUALIZACJĘ z id wpisu i nową treścią (zachowując istniejące informacje!)
4. Nigdy nie usuwaj istniejących informacji - tylko dodawaj lub rozszerzaj

Odpowiedz w formacie JSON:
{
  "action": "create" | "update" | "skip",
  "reason": "krótkie wyjaśnienie",
  "entryId": "id istniejącego wpisu (tylko dla update)",
  "title": "tytuł wpisu",
  "content": "treść wpisu (dla update - połączona stara + nowa)"
}

ISTNIEJĄCE ID WPISÓW:
${existingEntries.map((e: { id: string; title: string; content: string }) => `- ${e.id}: ${e.title}`).join("\n") || "(brak)"}

Odpowiedz TYLKO JSON, bez markdown.`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text().trim()

        // Parse AI response
        const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim()
        const mergeDecision = JSON.parse(cleanJson)

        action = mergeDecision.action
        reason = mergeDecision.reason

        if (mergeDecision.action === "create" && mergeDecision.title && mergeDecision.content) {
          entry = await prisma.knowledgeEntry.create({
            data: {
              title: mergeDecision.title,
              content: mergeDecision.content,
              categoryId,
              workspaceType: workspace || "WORK",
              userId: session.user.id,
            },
            include: {
              category: true,
            },
          })
        } else if (mergeDecision.action === "update" && mergeDecision.entryId && mergeDecision.content) {
          // Verify the entry exists and belongs to user
          const existingEntry = await prisma.knowledgeEntry.findFirst({
            where: {
              id: mergeDecision.entryId,
              userId: session.user.id,
            },
          })

          if (existingEntry) {
            entry = await prisma.knowledgeEntry.update({
              where: { id: mergeDecision.entryId },
              data: {
                title: mergeDecision.title || existingEntry.title,
                content: mergeDecision.content,
              },
              include: {
                category: true,
              },
            })
          }
        }
        // If action is "skip", entry remains null

      } catch (aiError) {
        console.error("AI merge failed, falling back to simple create:", aiError)
        // Fall through to simple create below
      }
    }

    // Fallback: simple create if AI didn't work or wasn't configured
    if (!entry && action !== "skip") {
      const entryTitle = title || `Notatka z ${new Date().toLocaleDateString("pl-PL")}`
      entry = await prisma.knowledgeEntry.create({
        data: {
          title: entryTitle,
          content: newInfo,
          categoryId,
          workspaceType: workspace || "WORK",
          userId: session.user.id,
        },
        include: {
          category: true,
        },
      })
      action = "create"
      reason = "Zapisano jako nowy wpis"
    }

    return NextResponse.json({
      action,
      reason,
      entry,
    })
  } catch (error) {
    console.error("Error merging knowledge:", error)
    return NextResponse.json({ error: "Nie udało się zapisać. Spróbuj ponownie." }, { status: 500 })
  }
}
