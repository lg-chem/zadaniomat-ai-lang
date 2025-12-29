import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { DEFAULT_SYSTEM_PROMPTS, DEFAULT_META_PROMPT } from "@/lib/ai-prompts"

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
      metaPrompt: knowledgeBase?.metaPrompt ?? DEFAULT_META_PROMPT,
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
    const { workspace = "WORK", instructions, systemPrompts, metaPrompt, personalInfo, companyInfo } = body

    const data: {
      chatInstructions?: string
      systemPrompts?: string
      metaPrompt?: string
      personalInfo?: string
      companyInfo?: string
    } = {}

    if (instructions) {
      data.chatInstructions = JSON.stringify(instructions)
    }
    if (systemPrompts) {
      data.systemPrompts = JSON.stringify(systemPrompts)
    }
    if (typeof metaPrompt === "string") {
      data.metaPrompt = metaPrompt
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
