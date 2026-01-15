import { streamText, tool } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { format, startOfDay, endOfDay, addDays } from "date-fns"
import { pl } from "date-fns/locale"
import { DEFAULT_SYSTEM_PROMPTS, DEFAULT_META_PROMPT } from "@/lib/ai-prompts"
import { searchKnowledge, searchConversations } from "@/lib/embeddings"

type ChatMode = "sprint_goals" | "daily_tasks" | "period_goals" | "general"

interface GoalContext {
  goalId: string
  goalTitle: string
  goalDescription?: string
  stage: "planning_steps" | "breakdown_tasks"
}

// Helper function to get team knowledge category IDs for a user
async function getTeamKnowledgeCategoryIds(userId: string): Promise<string[]> {
  const teamMemberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      assignedCategories: {
        include: { category: true },
      },
    },
  })

  const teamCategoryIds: string[] = []
  for (const membership of teamMemberships) {
    for (const assignedCat of membership.assignedCategories) {
      const cat = assignedCat.category
      if (cat.isStrategic && cat.organizationId) {
        teamCategoryIds.push(cat.id)
      }
    }
  }

  const categoriesViaOrg = await prisma.category.findMany({
    where: {
      isStrategic: true,
      workspaceType: "WORK",
      organizations: {
        some: {
          organization: {
            members: {
              some: { userId }
            }
          }
        }
      }
    },
    select: { id: true }
  })

  const existingIds = new Set(teamCategoryIds)
  for (const cat of categoriesViaOrg) {
    if (!existingIds.has(cat.id)) {
      teamCategoryIds.push(cat.id)
    }
  }

  const teamKnowledgeCategories = await prisma.knowledgeCategory.findMany({
    where: {
      linkedCategoryId: { in: teamCategoryIds },
    },
    select: { id: true },
  })

  return teamKnowledgeCategories.map(c => c.id)
}

// Minimal context - just essentials
async function getMinimalContext(userId: string) {
  const today = new Date()

  const teamCategoryIds = await getTeamKnowledgeCategoryIds(userId)

  const [categories, activePeriod, activeSprint, knowledgeBase, importantKnowledge] = await Promise.all([
    prisma.category.findMany({
      where: { userId, workspaceType: "WORK" },
      select: { name: true, isStrategic: true },
      orderBy: { order: "asc" },
    }),
    prisma.period.findFirst({
      where: { userId, workspaceType: "WORK", isActive: true },
      select: {
        name: true,
        startDate: true,
        endDate: true,
        goals: { select: { title: true, currentValue: true, targetValue: true, unit: true, isCompleted: true } }
      },
    }),
    prisma.sprint.findFirst({
      where: { isActive: true, period: { userId, workspaceType: "WORK", isActive: true } },
      include: { goals: { include: { category: { select: { name: true } } } } },
    }),
    prisma.aIKnowledgeBase.findUnique({
      where: { userId_workspaceType: { userId, workspaceType: "WORK" } },
      select: { chatInstructions: true, companyInfo: true, systemPrompts: true, metaPrompt: true },
    }),
    prisma.knowledgeEntry.findMany({
      where: {
        workspaceType: "WORK",
        isImportant: true,
        OR: [
          { userId },
          ...(teamCategoryIds.length > 0 ? [{
            visibility: "TEAM" as const,
            categoryId: { in: teamCategoryIds }
          }] : [])
        ]
      },
      select: { title: true, content: true, category: { select: { name: true } }, user: { select: { name: true } }, userId: true },
      take: 25,
    }),
  ])

  const categoryNames = categories.map((c: { name: string; isStrategic: boolean }) => c.name + (c.isStrategic ? " ★" : "")).join(", ")

  const periodGoalsList = activePeriod?.goals
    .filter((g: { isCompleted: boolean }) => !g.isCompleted)
    .map((g: { title: string; currentValue: number; targetValue: number | null; unit: string | null }) =>
      `${g.title}: ${g.currentValue}/${g.targetValue ?? 0} ${g.unit || ''}`
    ).join("; ") || null

  const sprintGoalsList = activeSprint?.goals
    .filter((g: { isCompleted: boolean }) => !g.isCompleted)
    .map((g: { title: string; currentValue: number; targetValue: number | null; unit: string | null }) =>
      `${g.title}: ${g.currentValue}/${g.targetValue ?? 0} ${g.unit || ''}`
    ).join("; ") || null

  const knowledgeSummary = importantKnowledge.length > 0
    ? importantKnowledge.map((k: { title: string; content: string | null; category: { name: string } | null; user: { name: string | null }; userId: string }) =>
        `• ${k.title}${k.category ? ` [${k.category.name}]` : ""}${k.userId !== userId ? ` (od: ${k.user?.name || "zespół"})` : ""}: ${k.content || ""}`
      ).join("\n")
    : null

  return {
    today: format(today, "EEEE, d MMMM yyyy", { locale: pl }),
    categories: categoryNames,
    currentPeriod: activePeriod ? `${activePeriod.name} (${format(activePeriod.startDate, "d.MM")} - ${format(activePeriod.endDate, "d.MM")})` : null,
    periodGoals: periodGoalsList,
    currentSprint: activeSprint ? `${activeSprint.name} (${format(activeSprint.startDate, "d.MM")} - ${format(activeSprint.endDate, "d.MM")})` : null,
    sprintGoals: sprintGoalsList,
    knowledgeBase,
    importantKnowledge: knowledgeSummary,
  }
}

// Tool implementations - these fetch additional context
async function getTodayTasks(userId: string) {
  const today = new Date()
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      workspaceType: "WORK",
      scheduledDate: { gte: startOfDay(today), lte: endOfDay(today) },
    },
    include: { category: true },
    orderBy: { orderInDay: "asc" },
  })
  return tasks.map((t) => ({
    title: t.title,
    status: t.status,
    category: t.category?.name,
    minutes: t.plannedMinutes,
  }))
}

async function getRecentTasks(userId: string, days: number = 7) {
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      workspaceType: "WORK",
      status: "COMPLETED",
      completedAt: { gte: addDays(new Date(), -days) },
    },
    include: { category: true },
    orderBy: { completedAt: "desc" },
    take: 15,
  })
  return tasks.map((t) => ({
    title: t.title,
    category: t.category?.name,
    date: t.completedAt ? format(t.completedAt, "d.MM", { locale: pl }) : null,
  }))
}

async function getBacklog(userId: string) {
  const items = await prisma.backlogItem.findMany({
    where: { userId, workspaceType: "WORK", isProcessed: false },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 10,
  })
  return items.map((i) => ({ content: i.content, priority: i.priority }))
}

async function getKnowledgeEntries(userId: string, query?: string) {
  const teamCategoryIds = await getTeamKnowledgeCategoryIds(userId)

  const items = await prisma.knowledgeEntry.findMany({
    where: {
      workspaceType: "WORK",
      OR: [
        { userId },
        ...(teamCategoryIds.length > 0 ? [{
          visibility: "TEAM" as const,
          categoryId: { in: teamCategoryIds }
        }] : [])
      ],
      ...(query ? {
        AND: [{
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { content: { contains: query, mode: "insensitive" as const } },
          ]
        }]
      } : { isImportant: true }),
    },
    include: { category: true, user: { select: { name: true } } },
    take: 15,
  })
  return items.map((e) => ({
    title: e.title,
    content: e.content?.substring(0, 800),
    category: e.category?.name,
    owner: e.userId !== userId ? e.user?.name : undefined,
  }))
}

async function getUpcomingTasks(userId: string, days: number = 7) {
  const today = new Date()
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      workspaceType: "WORK",
      scheduledDate: {
        gt: endOfDay(today),
        lte: endOfDay(addDays(today, days))
      },
      status: { not: "COMPLETED" },
    },
    include: { category: true },
    orderBy: { scheduledDate: "asc" },
    take: 20,
  })
  return tasks.map((t) => ({
    title: t.title,
    date: t.scheduledDate ? format(t.scheduledDate, "EEEE d.MM", { locale: pl }) : null,
    category: t.category?.name,
  }))
}

async function fetchWebPage(url: string): Promise<{ title: string; content: string; url: string } | null> {
  try {
    const parsedUrl = new URL(url)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return { title: "Błąd", content: `Nie udało się pobrać strony (status: ${response.status})`, url }
    }

    const html = await response.text()

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname

    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")

    content = content
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()

    if (content.length > 8000) {
      content = content.substring(0, 8000) + "... (treść skrócona)"
    }

    return { title, content, url }
  } catch (error) {
    console.error("Error fetching webpage:", error)
    return { title: "Błąd", content: "Nie udało się pobrać strony lub upłynął limit czasu.", url }
  }
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
  return text.match(urlRegex) || []
}

function getSystemPrompt(mode: ChatMode, context: Awaited<ReturnType<typeof getMinimalContext>>, goalContext?: GoalContext) {
  const metaPrompt = context.knowledgeBase?.metaPrompt ?? DEFAULT_META_PROMPT

  let customInstructions = ""
  if (context.knowledgeBase?.chatInstructions) {
    try {
      const instructionsObj = JSON.parse(context.knowledgeBase.chatInstructions)
      const modeInstruction = instructionsObj[mode] || instructionsObj.general || ""
      if (modeInstruction) customInstructions = `\n\n[Dodatkowe wytyczne]: ${modeInstruction}`
    } catch {
      customInstructions = `\n\n[Dodatkowe wytyczne]: ${context.knowledgeBase.chatInstructions}`
    }
  }

  let basePrompt = DEFAULT_SYSTEM_PROMPTS[mode] || DEFAULT_SYSTEM_PROMPTS.general
  if (context.knowledgeBase?.systemPrompts) {
    try {
      const customPrompts = JSON.parse(context.knowledgeBase.systemPrompts)
      if (mode in customPrompts) {
        basePrompt = customPrompts[mode]
      }
    } catch {
      // Use default if parsing fails
    }
  }

  const companyContext = context.knowledgeBase?.companyInfo
    ? `\n[Kontekst firmy]: ${context.knowledgeBase.companyInfo}`
    : ""

  const knowledgeContext = context.importantKnowledge
    ? `\n[Baza wiedzy - ważne wpisy]:\n${context.importantKnowledge}`
    : ""

  const baseContext = `
[Data]: ${context.today}
[Kategorie]: ${context.categories || "brak"}
[Okres]: ${context.currentPeriod || "brak aktywnego"} → Cele: ${context.periodGoals || "brak"}
[Sprint]: ${context.currentSprint || "brak aktywnego"} → Cele: ${context.sprintGoals || "brak"}${companyContext}${knowledgeContext}${customInstructions}`

  let goalPlanningContext = ""
  if (goalContext) {
    if (goalContext.stage === "planning_steps") {
      goalPlanningContext = `

[TRYB PLANOWANIA CELU]
Aktualnie pomagasz zaplanować realizację konkretnego Celu Okresu:
- Cel: "${goalContext.goalTitle}"
${goalContext.goalDescription ? `- Opis: ${goalContext.goalDescription}` : ""}

Twoim zadaniem jest pomóc użytkownikowi wymyślić KROKI REALIZACJI tego celu.
Gdy użytkownik będzie gotowy, użyj narzędzia proposeSteps aby zaproponować listę kroków.`
    } else if (goalContext.stage === "breakdown_tasks") {
      goalPlanningContext = `

[TRYB ROZBIJANIA NA ZADANIA]
Aktualnie pomagasz rozbić Cel Sprintu na konkretne Zadania:
- Cel Sprintu: "${goalContext.goalTitle}"
${goalContext.goalDescription ? `- Opis: ${goalContext.goalDescription}` : ""}

Twoim zadaniem jest pomóc użytkownikowi rozbić ten cel na ZADANIA.
Gdy użytkownik będzie gotowy, użyj narzędzia proposeTasks aby zaproponować listę zadań.`
    }
  }

  const toolsInstructions = `

NARZĘDZIA DO DYSPOZYCJI:
- Jeśli potrzebujesz danych (zadania na dziś, backlog, ostatnie zadania, wiedza, strona www) - użyj odpowiedniego narzędzia.
- Gdy chcesz zaproponować cele - użyj proposeGoals
- Gdy chcesz zaproponować zadania - użyj proposeTasks
- Gdy chcesz zaproponować kroki realizacji celu - użyj proposeSteps

Odpowiadaj naturalnie po polsku. Bądź zwięzły.`

  return `${metaPrompt}${basePrompt}
${baseContext}${goalPlanningContext}${toolsInstructions}`
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 })
    }

    const body = await req.json()
    const { messages, mode = "general", goalContext } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response("Messages array is required", { status: 400 })
    }

    const userId = session.user.id

    // Get minimal context
    const context = await getMinimalContext(userId)

    // Check for URLs in the last user message and pre-fetch them
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === "user").pop()
    let webpageContext = ""
    if (lastUserMessage?.content) {
      const urls = extractUrls(lastUserMessage.content)
      if (urls.length > 0) {
        const urlsToFetch = urls.slice(0, 3)
        const webpages = await Promise.all(urlsToFetch.map(url => fetchWebPage(url)))
        const validWebpages = webpages.filter(Boolean)

        if (validWebpages.length > 0) {
          webpageContext = "\n\n[Zawartość stron z linków w wiadomości]:\n" + validWebpages.map(page =>
            `--- ${page!.title} (${page!.url}) ---\n${page!.content}`
          ).join("\n\n")
        }
      }
    }

    // Get system prompt
    const systemPrompt = getSystemPrompt(mode as ChatMode, context, goalContext) + webpageContext

    // Define tools for AI to use
    const result = await streamText({
      model: google("gemini-3-flash-preview", {
        useSearchGrounding: true,
      }),
      system: systemPrompt,
      messages,
      maxSteps: 5,
      tools: {
        // Context fetching tools
        getTodayTasks: tool({
          description: "Pobierz listę zadań zaplanowanych na dzisiaj",
          parameters: z.object({}),
          execute: async () => {
            const tasks = await getTodayTasks(userId)
            return { tasks }
          },
        }),
        getRecentTasks: tool({
          description: "Pobierz ostatnio ukończone zadania",
          parameters: z.object({
            days: z.number().optional().describe("Liczba dni wstecz (domyślnie 7)"),
          }),
          execute: async ({ days }) => {
            const tasks = await getRecentTasks(userId, days || 7)
            return { tasks }
          },
        }),
        getBacklog: tool({
          description: "Pobierz listę pozycji z backlogu",
          parameters: z.object({}),
          execute: async () => {
            const items = await getBacklog(userId)
            return { items }
          },
        }),
        getKnowledge: tool({
          description: "Przeszukaj bazę wiedzy użytkownika",
          parameters: z.object({
            query: z.string().optional().describe("Fraza do wyszukania (opcjonalnie)"),
          }),
          execute: async ({ query }) => {
            const entries = await getKnowledgeEntries(userId, query)
            return { entries }
          },
        }),
        getUpcomingTasks: tool({
          description: "Pobierz zaplanowane zadania na najbliższe dni",
          parameters: z.object({
            days: z.number().optional().describe("Liczba dni (domyślnie 7)"),
          }),
          execute: async ({ days }) => {
            const tasks = await getUpcomingTasks(userId, days || 7)
            return { tasks }
          },
        }),
        fetchWebpage: tool({
          description: "Pobierz i przeanalizuj zawartość strony internetowej",
          parameters: z.object({
            url: z.string().url().describe("URL strony do pobrania"),
          }),
          execute: async ({ url }) => {
            const content = await fetchWebPage(url)
            return content || { error: "Nie udało się pobrać strony" }
          },
        }),

        // Semantic search tools (pgvector)
        semanticSearchKnowledge: tool({
          description: "Wyszukaj semantycznie w bazie wiedzy użytkownika (używa AI embeddings do znalezienia podobnych treści)",
          parameters: z.object({
            query: z.string().describe("Pytanie lub fraza do wyszukania"),
            limit: z.number().optional().describe("Maksymalna liczba wyników (domyślnie 10)"),
          }),
          execute: async ({ query, limit }) => {
            const teamCategoryIds = await getTeamKnowledgeCategoryIds(userId)
            const results = await searchKnowledge(query, userId, {
              limit: limit || 10,
              workspaceType: "WORK",
              includeTeamKnowledge: true,
              teamCategoryIds,
            })
            return {
              results: results.map(r => ({
                title: r.title,
                content: r.content.substring(0, 500),
                similarity: Math.round(r.similarity * 100) + "%",
              })),
              count: results.length,
            }
          },
        }),
        searchPastConversations: tool({
          description: "Wyszukaj w poprzednich rozmowach z AI (znajduje podobne tematy z historii chatów)",
          parameters: z.object({
            query: z.string().describe("Temat lub pytanie do wyszukania"),
            limit: z.number().optional().describe("Maksymalna liczba wyników (domyślnie 5)"),
          }),
          execute: async ({ query, limit }) => {
            const results = await searchConversations(query, userId, { limit: limit || 5 })
            return {
              conversations: results.map(r => ({
                title: r.title,
                summary: r.summary?.substring(0, 300),
                similarity: Math.round(r.similarity * 100) + "%",
              })),
              count: results.length,
            }
          },
        }),

        // Proposal tools - these return structured data
        proposeGoals: tool({
          description: "Zaproponuj listę celów do dodania (dla sprintu lub okresu)",
          parameters: z.object({
            goals: z.array(z.object({
              title: z.string().describe("Tytuł celu"),
              targetValue: z.number().optional().describe("Wartość docelowa"),
              unit: z.string().optional().describe("Jednostka np. 'zadań', 'godzin'"),
              category: z.string().nullable().optional().describe("Nazwa kategorii lub null"),
            })).describe("Lista proponowanych celów"),
            message: z.string().describe("Wiadomość towarzysząca propozycji"),
          }),
          execute: async ({ goals, message }) => {
            return { type: "goals_proposal", goals, message }
          },
        }),
        proposeTasks: tool({
          description: "Zaproponuj listę zadań do dodania",
          parameters: z.object({
            tasks: z.array(z.object({
              title: z.string().describe("Tytuł zadania"),
              category: z.string().nullable().optional().describe("Nazwa kategorii lub null"),
              plannedMinutes: z.number().optional().describe("Planowany czas w minutach"),
              goalId: z.string().optional().describe("ID celu sprintu (jeśli powiązane)"),
            })).describe("Lista proponowanych zadań"),
            message: z.string().describe("Wiadomość towarzysząca propozycji"),
          }),
          execute: async ({ tasks, message }) => {
            return { type: "tasks_proposal", tasks, message }
          },
        }),
        proposeSteps: tool({
          description: "Zaproponuj kroki realizacji celu (dla celów okresu)",
          parameters: z.object({
            steps: z.array(z.object({
              title: z.string().describe("Tytuł kroku"),
              description: z.string().optional().describe("Opis kroku"),
            })).describe("Lista proponowanych kroków"),
            parentGoalId: z.string().describe("ID celu nadrzędnego"),
            message: z.string().describe("Wiadomość towarzysząca propozycji"),
          }),
          execute: async ({ steps, parentGoalId, message }) => {
            return { type: "steps_proposal", steps, parentGoalId, message }
          },
        }),
      },
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Error in AI chat:", error)
    return new Response("Server error", { status: 500 })
  }
}
