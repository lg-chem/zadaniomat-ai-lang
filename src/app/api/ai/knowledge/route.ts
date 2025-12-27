import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceType = searchParams.get("workspaceType") || "PRIVATE"

    const knowledgeBase = await prisma.aIKnowledgeBase.findUnique({
      where: {
        userId_workspaceType: {
          userId: session.user.id,
          workspaceType: workspaceType as "WORK" | "PRIVATE",
        },
      },
    })

    return NextResponse.json(knowledgeBase)
  } catch (error) {
    console.error("Error fetching knowledge base:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { workspaceType, personalInfo, companyInfo, chatInstructions } = body

    if (!workspaceType) {
      return NextResponse.json(
        { error: "workspaceType is required" },
        { status: 400 }
      )
    }

    const knowledgeBase = await prisma.aIKnowledgeBase.upsert({
      where: {
        userId_workspaceType: {
          userId: session.user.id,
          workspaceType: workspaceType as "WORK" | "PRIVATE",
        },
      },
      update: {
        personalInfo,
        companyInfo,
        chatInstructions,
      },
      create: {
        userId: session.user.id,
        workspaceType: workspaceType as "WORK" | "PRIVATE",
        personalInfo,
        companyInfo,
        chatInstructions,
      },
    })

    return NextResponse.json(knowledgeBase)
  } catch (error) {
    console.error("Error updating knowledge base:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
