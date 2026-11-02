import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Per user - never rendered at build time
export const dynamic = "force-dynamic"

// Tab links in the order the user set, e.g. ["/notes", "/schedule"]
const tabList = z.array(z.string().regex(/^\/[a-z0-9-]+$/)).max(50)
const navOrderSchema = z.object({
  order: z.object({
    WORK: tabList.optional(),
    PRIVATE: tabList.optional(),
  }),
})

// GET - order of the side menu tabs set by the user (null - default order)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const layout = await prisma.navLayout.findUnique({
      where: { userId: session.user.id },
      select: { tabOrder: true },
    })
    return NextResponse.json({ order: layout?.tabOrder ?? null })
  } catch (error) {
    console.error("Error fetching nav order:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PUT - saves the order, so it's the same on every device
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = navOrderSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowa kolejność" }, { status: 400 })
    }

    const layout = await prisma.navLayout.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, tabOrder: parsed.data.order },
      update: { tabOrder: parsed.data.order },
      select: { tabOrder: true },
    })
    return NextResponse.json({ order: layout.tabOrder })
  } catch (error) {
    console.error("Error saving nav order:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
