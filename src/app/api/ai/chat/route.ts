import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { generateAIResponse } from "@/lib/gemini"
import { format, startOfDay, endOfDay, addDays } from "date-fns"
import { pl } from "date-fns/locale"

type ChatMode = "sprint_goals" | "daily_tasks"

interface ChatRequest {
  message: string
  mode: ChatMode
  history?: { role: "user" | "assistant"; content: string }[]
}

async function getUserContext(userId: string, mode: ChatMode) {
  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")

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
  }
}

function getSystemPrompt(mode: ChatMode, context: Awaited<ReturnType<typeof getUserContext>>) {
  const contextJson = JSON.stringify(context, null, 2)

  if (mode === "sprint_goals") {
    return `Jesteś asystentem do planowania celów sprintowych. Rozmawiasz po polsku.

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

  // daily_tasks mode
  return `Jesteś asystentem do planowania zadań na dzień. Rozmawiasz po polsku.

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
