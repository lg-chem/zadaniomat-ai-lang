import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { generateAIResponse } from "@/lib/gemini"
import { format, startOfDay, endOfDay, addDays } from "date-fns"
import { pl } from "date-fns/locale"
import { DEFAULT_SYSTEM_PROMPTS } from "@/lib/ai-prompts"

type ChatMode = "sprint_goals" | "daily_tasks" | "period_goals" | "general"

interface ChatRequest {
  message: string
  mode: ChatMode
  history?: { role: "user" | "assistant"; content: string }[]
}

// Minimal context - just essentials
async function getMinimalContext(userId: string) {
  const today = new Date()

  const [categories, activePeriod, activeSprint, knowledgeBase] = await Promise.all([
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
      select: { chatInstructions: true, companyInfo: true, systemPrompts: true },
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

  return {
    today: format(today, "EEEE, d MMMM yyyy", { locale: pl }),
    categories: categoryNames,
    currentPeriod: activePeriod ? `${activePeriod.name} (${format(activePeriod.startDate, "d.MM")} - ${format(activePeriod.endDate, "d.MM")})` : null,
    periodGoals: periodGoalsList,
    currentSprint: activeSprint ? `${activeSprint.name} (${format(activeSprint.startDate, "d.MM")} - ${format(activeSprint.endDate, "d.MM")})` : null,
    sprintGoals: sprintGoalsList,
    knowledgeBase,
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
  const items = await prisma.knowledgeEntry.findMany({
    where: {
      userId,
      workspaceType: "WORK",
      ...(query ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { content: { contains: query, mode: "insensitive" as const } },
        ]
      } : { isImportant: true }),
    },
    include: { category: true },
    take: 10,
  })
  return items.map((e: { title: string; content: string | null; category: { name: string } | null }) => ({
    title: e.title,
    content: e.content?.substring(0, 200),
    category: e.category?.name,
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
    default:
      return null
  }
}

function getSystemPrompt(mode: ChatMode, context: Awaited<ReturnType<typeof getMinimalContext>>) {
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
  let basePrompt = DEFAULT_SYSTEM_PROMPTS[mode] || DEFAULT_SYSTEM_PROMPTS.general
  if (context.knowledgeBase?.systemPrompts) {
    try {
      const customPrompts = JSON.parse(context.knowledgeBase.systemPrompts)
      if (customPrompts[mode]) {
        basePrompt = customPrompts[mode]
      }
    } catch {
      // Use default if parsing fails
    }
  }

  const companyContext = context.knowledgeBase?.companyInfo
    ? `\n[Kontekst firmy]: ${context.knowledgeBase.companyInfo}`
    : ""

  const baseContext = `
[Data]: ${context.today}
[Kategorie]: ${context.categories || "brak"}
[Okres]: ${context.currentPeriod || "brak aktywnego"} → Cele: ${context.periodGoals || "brak"}
[Sprint]: ${context.currentSprint || "brak aktywnego"} → Cele: ${context.sprintGoals || "brak"}${companyContext}${customInstructions}`

  const jsonInstructions = `

ODPOWIADAJ W JSON:
- Zwykła rozmowa: {"type": "message", "message": "..."}
- Propozycja celów: {"type": "goals_proposal", "goals": [{"title": "...", "targetValue": N, "unit": "...", "category": "...lub null"}], "message": "..."}
- Propozycja zadań: {"type": "tasks_proposal", "tasks": [{"title": "...", "category": "...lub null", "plannedMinutes": N}], "message": "..."}
- Potrzebujesz więcej danych: {"type": "need_context", "contextType": "today_tasks|recent_tasks|backlog|knowledge|upcoming_tasks", "params": "opcjonalne", "message": "Co sprawdzam..."}

ZAWSZE odpowiadaj TYLKO poprawnym JSON.`

  return `${basePrompt}
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

    // Build conversation
    const conversationHistory = history
      .map((h) => `${h.role === "user" ? "Ty" : "Ja"}: ${h.content}`)
      .join("\n")

    const fullPrompt = conversationHistory
      ? `${conversationHistory}\n\nTy: ${message}`
      : message

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
