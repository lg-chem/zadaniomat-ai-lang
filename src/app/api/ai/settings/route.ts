import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Default system prompts - user can override these
export const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  general: `Jesteś moim asystentem i partnerem biznesowym. Rozmawiamy po polsku, bezpośrednio i konkretnie.

Nie jesteś sztywnym botem - jesteś pomocnikiem który zna mój kontekst pracy. Możesz pytać, sugerować, kwestionować. Mów jak kolega z zespołu, nie jak robot. Bądź zwięzły.

WAŻNE: Bądź elastyczny. Jak zmieniam temat - idź ze mną. Nie wracaj uporczywie do poprzednich tematów czy notatek, chyba że sam o to poproszę.

Jeśli potrzebujesz szczegółowych danych (co mam dziś, co robiłem ostatnio, backlog, notatki), poproś o nie przez "need_context".`,

  sprint_goals: `Pomagasz mi planować cele na sprint (2 tygodnie). Znasz moje cele okresowe i możesz zaproponować jak je rozbić.

Nie dawaj od razu listy celów - najpierw pogadajmy. Zapytaj co chcę osiągnąć, co mi nie wyszło w poprzednim sprincie. Bądź partnerem, nie generatorem list.

WAŻNE: Bądź elastyczny. Jak zmieniam temat - idź ze mną. Nie wracaj uporczywie do planowania jeśli chcę pogadać o czymś innym.

Jeśli potrzebujesz kontekstu (co robiłem, backlog), poproś przez "need_context".`,

  period_goals: `Pomagasz mi planować cele na okres (zwykle 3 miesiące). To strategiczne planowanie.

Zanim cokolwiek zaproponujesz - porozmawiaj. Zapytaj o priorytety, o to co mnie blokuje, gdzie chcę być za 3 miesiące. Możesz kwestionować moje pomysły jeśli widzisz że są nierealne.

WAŻNE: Bądź elastyczny. Jak zmieniam temat - idź ze mną. Nie usadzaj się na jednym wątku.

Jeśli potrzebujesz więcej kontekstu, poproś przez "need_context".`,

  daily_tasks: `Pomagasz mi planować dzień. Znasz moje cele sprintu i możesz sugerować zadania.

NIE dawaj od razu listy zadań. Zapytaj najpierw: ile mam czasu? co jest pilne? jak się czuję? Planuj ze mną, nie za mnie.

WAŻNE: Bądź elastyczny. Jak zmieniam temat lub chcę pogadać o czymś innym - idź ze mną. Nie wracaj uporczywie do planowania dnia.

Możesz poprosić o kontekst (dzisiejsze zadania, backlog, ostatnie zrobione) przez "need_context".`,
}

// GET - get AI settings (chat instructions per type)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get("workspace") || "WORK"

    const knowledgeBase = await prisma.aIKnowledgeBase.findUnique({
      where: {
        userId_workspaceType: {
          userId: session.user.id,
          workspaceType: workspace as "WORK" | "PRIVATE",
        },
      },
    })

    // Parse chatInstructions as JSON (per-type instructions)
    let instructions: Record<string, string> = {}
    if (knowledgeBase?.chatInstructions) {
      try {
        instructions = JSON.parse(knowledgeBase.chatInstructions)
      } catch {
        // Legacy: single string for all types
        instructions = { general: knowledgeBase.chatInstructions }
      }
    }

    // Parse systemPrompts or use defaults
    let systemPrompts: Record<string, string> = { ...DEFAULT_SYSTEM_PROMPTS }
    if (knowledgeBase?.systemPrompts) {
      try {
        const customPrompts = JSON.parse(knowledgeBase.systemPrompts)
        // Merge custom prompts with defaults (custom overrides defaults)
        systemPrompts = { ...DEFAULT_SYSTEM_PROMPTS, ...customPrompts }
      } catch {
        // Keep defaults if parsing fails
      }
    }

    return NextResponse.json({
      instructions,
      systemPrompts,
      personalInfo: knowledgeBase?.personalInfo || "",
      companyInfo: knowledgeBase?.companyInfo || "",
    })
  } catch (error) {
    console.error("Error fetching AI settings:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - update AI settings
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { workspace = "WORK", instructions, systemPrompts, personalInfo, companyInfo } = body

    const data: {
      chatInstructions?: string
      systemPrompts?: string
      personalInfo?: string
      companyInfo?: string
    } = {}

    if (instructions) {
      data.chatInstructions = JSON.stringify(instructions)
    }
    if (systemPrompts) {
      data.systemPrompts = JSON.stringify(systemPrompts)
    }
    if (typeof personalInfo === "string") {
      data.personalInfo = personalInfo
    }
    if (typeof companyInfo === "string") {
      data.companyInfo = companyInfo
    }

    const knowledgeBase = await prisma.aIKnowledgeBase.upsert({
      where: {
        userId_workspaceType: {
          userId: session.user.id,
          workspaceType: workspace as "WORK" | "PRIVATE",
        },
      },
      update: data,
      create: {
        userId: session.user.id,
        workspaceType: workspace as "WORK" | "PRIVATE",
        ...data,
      },
    })

    return NextResponse.json({ success: true, knowledgeBase })
  } catch (error) {
    console.error("Error updating AI settings:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
