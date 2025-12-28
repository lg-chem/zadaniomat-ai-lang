import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { generateAIResponse } from "@/lib/gemini"
import { format, startOfDay, endOfDay, addDays } from "date-fns"
import { pl } from "date-fns/locale"

type ChatMode = "sprint_goals" | "daily_tasks" | "period_goals"

interface ChatRequest {
  message: string
  mode: ChatMode
  history?: { role: "user" | "assistant"; content: string }[]
}

async function getUserContext(userId: string, mode: ChatMode) {
  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")

  // Get AI knowledge base for WORK workspace
  const knowledgeBase = await prisma.aIKnowledgeBase.findUnique({
    where: {
      userId_workspaceType: {
        userId,
        workspaceType: "WORK",
      },
    },
  })

  // Get knowledge entries (important ones first)
  const knowledgeEntries = await prisma.knowledgeEntry.findMany({
    where: {
      userId,
      workspaceType: "WORK",
    },
    include: {
      category: true,
    },
    orderBy: [{ isImportant: "desc" }, { updatedAt: "desc" }],
    take: 30, // Limit to avoid too much context
  })

  // Get active fitness goals
  const activeFitnessGoals = await prisma.fitnessGoal.findMany({
    where: {
      userId,
      endDate: {
        gte: today,
      },
      isCompleted: false,
    },
    orderBy: { startDate: "desc" },
  })

  // Get backlog items
  const backlogItems = await prisma.backlogItem.findMany({
    where: {
      userId,
      workspaceType: "WORK",
    },
    orderBy: { createdAt: "desc" },
    take: 20, // Limit to last 20 items
  })

  // Get active period and sprint for WORK workspace
  const activePeriod = await prisma.period.findFirst({
    where: {
      userId,
      workspaceType: "WORK",
      isActive: true,
    },
    include: {
      goals: true,
    },
  })

  const activeSprint = await prisma.sprint.findFirst({
    where: {
      isActive: true,
      period: {
        userId,
        workspaceType: "WORK",
        isActive: true,
      },
    },
    include: {
      goals: {
        include: { category: true },
      },
    },
  })

  // Get today's tasks
  const todayTasks = await prisma.task.findMany({
    where: {
      userId,
      workspaceType: "WORK",
      scheduledDate: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
    include: { category: true },
    orderBy: { orderInDay: "asc" },
  })

  // Get recent completed tasks (last 7 days)
  const recentTasks = await prisma.task.findMany({
    where: {
      userId,
      workspaceType: "WORK",
      status: "COMPLETED",
      completedAt: {
        gte: addDays(today, -7),
      },
    },
    include: { category: true },
    orderBy: { completedAt: "desc" },
    take: 20,
  })

  // Get categories
  const categories = await prisma.category.findMany({
    where: {
      userId,
      workspaceType: "WORK",
    },
    orderBy: { order: "asc" },
  })

  return {
    today: format(today, "EEEE, d MMMM yyyy", { locale: pl }),
    knowledgeBase: knowledgeBase
      ? {
          personalInfo: knowledgeBase.personalInfo,
          companyInfo: knowledgeBase.companyInfo,
          chatInstructions: knowledgeBase.chatInstructions,
        }
      : null,
    fitnessGoals: activeFitnessGoals.map((g) => ({
      name: g.name,
      goalType: g.goalType,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      unit: g.unit,
      startDate: format(g.startDate, "d MMM yyyy", { locale: pl }),
      endDate: format(g.endDate, "d MMM yyyy", { locale: pl }),
    })),
    activePeriod: activePeriod
      ? {
          name: activePeriod.name,
          startDate: format(activePeriod.startDate, "d MMM yyyy", { locale: pl }),
          endDate: format(activePeriod.endDate, "d MMM yyyy", { locale: pl }),
          goals: activePeriod.goals.map((g) => ({
            title: g.title,
            currentValue: g.currentValue,
            targetValue: g.targetValue,
            unit: g.unit,
            isCompleted: g.isCompleted,
          })),
        }
      : null,
    activeSprint: activeSprint
      ? {
          name: activeSprint.name,
          startDate: format(activeSprint.startDate, "d MMM yyyy", { locale: pl }),
          endDate: format(activeSprint.endDate, "d MMM yyyy", { locale: pl }),
          goals: activeSprint.goals.map((g) => ({
            title: g.title,
            category: g.category?.name,
            currentValue: g.currentValue,
            targetValue: g.targetValue,
            unit: g.unit,
            isCompleted: g.isCompleted,
          })),
        }
      : null,
    todayTasks: todayTasks.map((t) => ({
      title: t.title,
      status: t.status,
      category: t.category?.name,
      plannedMinutes: t.plannedMinutes,
    })),
    recentCompletedTasks: recentTasks.map((t) => ({
      title: t.title,
      category: t.category?.name,
      completedAt: t.completedAt ? format(t.completedAt, "d MMM", { locale: pl }) : null,
    })),
    categories: categories.map((c) => ({
      name: c.name,
      isStrategic: c.isStrategic,
    })),
    backlog: backlogItems.map((item) => ({
      content: item.content,
      priority: item.priority,
      isProcessed: item.isProcessed,
    })),
    knowledgeEntries: knowledgeEntries.map((entry) => ({
      title: entry.title,
      content: entry.content,
      category: entry.category?.name,
      isImportant: entry.isImportant,
    })),
  }
}

function getSystemPrompt(mode: ChatMode, context: Awaited<ReturnType<typeof getUserContext>>) {
  const contextJson = JSON.stringify(context, null, 2)
  const customInstructions = context.knowledgeBase?.chatInstructions
    ? `\n\nINSTRUKCJE OD UŻYTKOWNIKA:\n${context.knowledgeBase.chatInstructions}`
    : ""

  if (mode === "sprint_goals") {
    return `Jesteś asystentem do planowania celów sprintowych. Rozmawiasz po polsku.${customInstructions}

KONTEKST UŻYTKOWNIKA:
${contextJson}

TWOJE ZADANIE:
1. Pomagasz użytkownikowi tworzyć cele na sprint
2. Bazujesz na celach okresu (period goals) i proponujesz jak je rozbić na mniejsze cele sprintowe
3. Sugerujesz konkretne, mierzalne cele z wartościami docelowymi
4. Możesz proponować kategorie dla celów

WAŻNE:
- Gdy użytkownik poprosi o zaproponowanie celów, odpowiedz w formacie JSON:
{
  "type": "goals_proposal",
  "goals": [
    {
      "title": "Tytuł celu",
      "description": "Opis",
      "targetValue": 10,
      "unit": "zadań",
      "category": "Nazwa kategorii lub null"
    }
  ],
  "message": "Twój komentarz do propozycji"
}

- Gdy prowadzisz normalną rozmowę, odpowiedz w formacie:
{
  "type": "message",
  "message": "Twoja odpowiedź"
}

Zawsze odpowiadaj w formacie JSON.`
  }

  if (mode === "period_goals") {
    return `Jesteś asystentem do planowania celów na okres (Period). Rozmawiasz po polsku.${customInstructions}

KONTEKST UŻYTKOWNIKA:
${contextJson}

TWOJE ZADANIE:
1. Pomagasz użytkownikowi tworzyć długoterminowe cele na okres (zwykle 3 miesiące)
2. Cele okresowe są strategiczne i skupiają się na rozwoju w kategoriach
3. Cele okresowe są później dzielone na cele sprintowe (2 tygodnie)
4. Sugerujesz konkretne, mierzalne cele z wartościami docelowymi
5. Możesz proponować kategorie dla celów (szczególnie strategiczne)

WAŻNE:
- Gdy użytkownik poprosi o zaproponowanie celów na okres, odpowiedz w formacie JSON:
{
  "type": "goals_proposal",
  "goals": [
    {
      "title": "Tytuł celu okresowego",
      "description": "Szczegółowy opis dlaczego ten cel jest ważny",
      "targetValue": 50,
      "unit": "zadań/godzin/projektów",
      "category": "Nazwa kategorii lub null"
    }
  ],
  "message": "Twój komentarz do propozycji celów okresowych"
}

- Gdy prowadzisz normalną rozmowę, odpowiedz w formacie:
{
  "type": "message",
  "message": "Twoja odpowiedź"
}

Zawsze odpowiadaj w formacie JSON.`
  }

  // daily_tasks mode
  return `Jesteś asystentem do planowania zadań na dzień. Rozmawiasz po polsku.${customInstructions}

KONTEKST UŻYTKOWNIKA:
${contextJson}

TWOJE ZADANIE:
1. Pomagasz użytkownikowi zaplanować zadania na dziś
2. Bierzesz pod uwagę cele sprintu i okresu
3. Proponujesz zadania, które przybliżą użytkownika do osiągnięcia celów
4. Dbasz o równowagę między kategoriami (szczególnie strategicznymi)
5. Sugerujesz realistyczny czas na zadania (w minutach)

WAŻNE:
- Gdy użytkownik poprosi o zaproponowanie zadań, odpowiedz w formacie JSON:
{
  "type": "tasks_proposal",
  "tasks": [
    {
      "title": "Tytuł zadania",
      "category": "Nazwa kategorii lub null",
      "plannedMinutes": 25
    }
  ],
  "message": "Twój komentarz do propozycji"
}

- Gdy prowadzisz normalną rozmowę, odpowiedz w formacie:
{
  "type": "message",
  "message": "Twoja odpowiedź"
}

Zawsze odpowiadaj w formacie JSON.`
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

    // Get user context
    const context = await getUserContext(session.user.id, mode)

    // Build prompt with history
    const conversationHistory = history
      .map((h) => `${h.role === "user" ? "Użytkownik" : "Asystent"}: ${h.content}`)
      .join("\n")

    const fullPrompt = conversationHistory
      ? `${conversationHistory}\n\nUżytkownik: ${message}`
      : message

    // Get system prompt
    const systemPrompt = getSystemPrompt(mode, context)

    // Generate response
    const response = await generateAIResponse(fullPrompt, systemPrompt)

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(response)
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
