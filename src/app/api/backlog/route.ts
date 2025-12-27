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
    const workspace = searchParams.get("workspace") || "WORK"
    const showProcessed = searchParams.get("showProcessed") === "true"

    const items = await prisma.backlogItem.findMany({
      where: {
        userId: session.user.id,
        workspaceType: workspace,
        ...(showProcessed ? {} : { isProcessed: false }),
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error("Error fetching backlog:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { content, workspaceType = "WORK", priority = 0 } = body

    if (!content) {
      return NextResponse.json({ error: "Treść jest wymagana" }, { status: 400 })
    }

    const item = await prisma.backlogItem.create({
      data: {
        content,
        workspaceType,
        priority,
        userId: session.user.id,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error("Error creating backlog item:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
