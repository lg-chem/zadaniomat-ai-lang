import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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

    return NextResponse.json({
      instructions,
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
    const { workspace = "WORK", instructions, personalInfo, companyInfo } = body

    const data: {
      chatInstructions?: string
      personalInfo?: string
      companyInfo?: string
    } = {}

    if (instructions) {
      data.chatInstructions = JSON.stringify(instructions)
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
