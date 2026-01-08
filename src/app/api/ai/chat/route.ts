import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { generateAIResponse } from "@/lib/gemini"
import { format, startOfDay, endOfDay, addDays } from "date-fns"
import { pl } from "date-fns/locale"
import { DEFAULT_SYSTEM_PROMPTS, DEFAULT_META_PROMPT } from "@/lib/ai-prompts"

type ChatMode = "sprint_goals" | "daily_tasks" | "period_goals" | "general"

interface ChatRequest {
  message: string
  mode: ChatMode
  history?: { role: "user" | "assistant"; content: string }[]
}

// Helper function to get team knowledge category IDs for a user
async function getTeamKnowledgeCategoryIds(userId: string): Promise<string[]> {
  // Get team memberships and assigned categories (legacy way)
  const teamMemberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      assignedCategories: {
        include: { category: true },
      },
    },
  })

  // Collect team strategic category IDs (legacy way)
  const teamCategoryIds: string[] = []
  for (const membership of teamMemberships) {
    for (const assignedCat of membership.assignedCategories) {
      const cat = assignedCat.category
      if (cat.isStrategic && cat.organizationId) {
        teamCategoryIds.push(cat.id)
      }
    }
  }

  // Also get categories shared via new many-to-many CategoryOrganization
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

  // Add to teamCategoryIds (avoid duplicates)
  const existingIds = new Set(teamCategoryIds)
  for (const cat of categoriesViaOrg) {
    if (!existingIds.has(cat.id)) {
      teamCategoryIds.push(cat.id)
    }
  }

  // Get knowledge category IDs linked to team categories
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

  // Get team knowledge category IDs for shared knowledge access
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
    // Fetch important knowledge entries (own + team shared)
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

  // Format important knowledge - no character limit for important entries
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

// On-demand context fetchers
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
  return tasks.map((t: { title: string; status: string; plannedMinutes: number | null; category: { name: string } | null }) => ({
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
  return tasks.map((t: { title: string; completedAt: Date | null; category: { name: string } | null }) => ({
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
  return items.map((i: { content: string; priority: number }) => ({ content: i.content, priority: i.priority }))
}

async function getKnowledgeEntries(userId: string, query?: string) {
  // Get team knowledge category IDs for shared knowledge access
  const teamCategoryIds = await getTeamKnowledgeCategoryIds(userId)

  const items = await prisma.knowledgeEntry.findMany({
    where: {
      workspaceType: "WORK",
      OR: [
        // User's own entries (any visibility)
        { userId },
        // Team shared entries from linked categories
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
  return items.map((e: { title: string; content: string | null; category: { name: string } | null; user: { name: string | null }; userId: string }) => ({
    title: e.title,
    content: e.content?.substring(0, 800),
    category: e.category?.name,
    owner: e.userId !== userId ? e.user?.name : undefined, // Show owner if not current user
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
  return tasks.map((t: { title: string; scheduledDate: Date | null; category: { name: string } | null }) => ({
    title: t.title,
    date: t.scheduledDate ? format(t.scheduledDate, "EEEE d.MM", { locale: pl }) : null,
    category: t.category?.name,
  }))
}

// Fetch and extract content from a web page
async function fetchWebPage(url: string): Promise<{ title: string; content: string; url: string } | null> {
  try {
    // Validate URL
    const parsedUrl = new URL(url)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })

    if (!response.ok) {
      return { title: "Błąd", content: `Nie udało się pobrać strony (status: ${response.status})`, url }
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname

    // Remove scripts, styles, and other non-content elements
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")

    // Extract text from remaining HTML
    content = content
      .replace(/<[^>]+>/g, " ") // Remove all remaining tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim()

    // Limit content length
    if (content.length > 8000) {
      content = content.substring(0, 8000) + "... (treść skrócona)"
    }

    return { title, content, url }
  } catch (error) {
    console.error("Error fetching webpage:", error)
    return { title: "Błąd", content: "Nie udało się pobrać strony lub upłynął limit czasu.", url }
  }
}

// Extract URLs from message
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
  return text.match(urlRegex) || []
}

// Context fetcher dispatcher
async function fetchContext(userId: string, contextType: string, params?: string) {
  switch (contextType) {
    case "today_tasks":
      return { todayTasks: await getTodayTasks(userId) }
    case "recent_tasks":
      return { recentTasks: await getRecentTasks(userId, params ? parseInt(params) : 7) }
    case "backlog":
      return { backlog: await getBacklog(userId) }
    case "knowledge":
      return { knowledge: await getKnowledgeEntries(userId, params) }
    case "upcoming_tasks":
      return { upcomingTasks: await getUpcomingTasks(userId, params ? parseInt(params) : 7) }
    case "webpage":
      if (params) {
        const webContent = await fetchWebPage(params)
        return webContent ? { webpage: webContent } : null
      }
      return null
    default:
      return null
  }
}

function getSystemPrompt(mode: ChatMode, context: Awaited<ReturnType<typeof getMinimalContext>>) {
  // Get meta prompt (global instructions) - comes FIRST
  const metaPrompt = context.knowledgeBase?.metaPrompt ?? DEFAULT_META_PROMPT

  // Parse custom instructions (additional per-mode instructions)
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

  // Get base system prompt - custom or default
  // If user explicitly set empty string, use empty (not default)
  let basePrompt = DEFAULT_SYSTEM_PROMPTS[mode] || DEFAULT_SYSTEM_PROMPTS.general
  if (context.knowledgeBase?.systemPrompts) {
    try {
      const customPrompts = JSON.parse(context.knowledgeBase.systemPrompts)
      // Check if key exists (even if empty string)
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

  const jsonInstructions = `

ODPOWIADAJ W JSON:
- Zwykła rozmowa: {"type": "message", "message": "..."}
- Propozycja celów: {"type": "goals_proposal", "goals": [{"title": "...", "targetValue": N, "unit": "...", "category": "...lub null"}], "message": "..."}
- Propozycja zadań: {"type": "tasks_proposal", "tasks": [{"title": "...", "category": "...lub null", "plannedMinutes": N}], "message": "..."}
- Potrzebujesz więcej danych: {"type": "need_context", "contextType": "today_tasks|recent_tasks|backlog|knowledge|upcoming_tasks|webpage", "params": "opcjonalne (dla webpage podaj URL)", "message": "Co sprawdzam..."}

ZAWSZE odpowiadaj TYLKO poprawnym JSON.`

  // Meta prompt comes FIRST, then base prompt, then context, then JSON format
  return `${metaPrompt}${basePrompt}
${baseContext}${jsonInstructions}`
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: ChatRequest = await req.json()
    const { message, mode, history = [] } = body

    if (!message || !mode) {
      return NextResponse.json({ error: "Message and mode are required" }, { status: 400 })
    }

    const userId = session.user.id

    // Get minimal context
    const context = await getMinimalContext(userId)

    // Detect URLs in message and auto-fetch them
    const urls = extractUrls(message)
    let webpageContext = ""
    if (urls.length > 0) {
      // Fetch up to 3 URLs to avoid timeouts
      const urlsToFetch = urls.slice(0, 3)
      const webpages = await Promise.all(urlsToFetch.map(url => fetchWebPage(url)))
      const validWebpages = webpages.filter(Boolean)

      if (validWebpages.length > 0) {
        webpageContext = "\n\n[Zawartość stron z linków]:\n" + validWebpages.map(page =>
          `--- ${page!.title} (${page!.url}) ---\n${page!.content}`
        ).join("\n\n")
      }
    }

    // Build conversation
    const conversationHistory = history
      .map((h) => `${h.role === "user" ? "Ty" : "Ja"}: ${h.content}`)
      .join("\n")

    const fullPrompt = conversationHistory
      ? `${conversationHistory}\n\nTy: ${message}${webpageContext}`
      : `${message}${webpageContext}`

    // Get system prompt
    const systemPrompt = getSystemPrompt(mode, context)

    // Generate response
    let response = await generateAIResponse(fullPrompt, systemPrompt)

    // Try to parse JSON response
    try {
      let parsed = JSON.parse(response)

      // Handle context request - fetch data and regenerate response
      if (parsed.type === "need_context") {
        const additionalContext = await fetchContext(userId, parsed.contextType, parsed.params)

        if (additionalContext) {
          // Re-generate with additional context
          const enrichedPrompt = `${fullPrompt}\n\n[Dodatkowy kontekst - ${parsed.contextType}]:\n${JSON.stringify(additionalContext, null, 2)}\n\nTeraz odpowiedz na podstawie tego kontekstu.`
          response = await generateAIResponse(enrichedPrompt, systemPrompt)

          try {
            parsed = JSON.parse(response)
          } catch {
            parsed = { type: "message", message: response }
          }
        }
      }

      return NextResponse.json(parsed)
    } catch {
      // If not JSON, wrap in message format
      return NextResponse.json({
        type: "message",
        message: response,
      })
    }
  } catch (error) {
    console.error("Error in AI chat:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
