import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Default sidebar items for work workspace
const DEFAULT_SIDEBAR_CONFIG = [
  { id: "teams", label: "Zespoły", enabled: true, order: 0 },
  { id: "backlog", label: "Backlog", enabled: true, order: 1 },
  { id: "task-stack", label: "Stos zadań", enabled: true, order: 2 },
  { id: "ai", label: "AI Asystent", enabled: true, order: 3 },
  { id: "knowledge", label: "Wiedza", enabled: true, order: 4 },
  { id: "ideas", label: "Rozkminki", enabled: true, order: 5 },
  { id: "schedule", label: "Harmonogram", enabled: true, order: 6 },
  { id: "calendar", label: "Kalendarz", enabled: true, order: 7 },
  { id: "goals", label: "Cele", enabled: true, order: 8 },
  { id: "sprints", label: "Sprinty", enabled: true, order: 9 },
  { id: "recurring", label: "Cykliczne", enabled: true, order: 10 },
  { id: "stats", label: "Statystyki", enabled: true, order: 11 },
]

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: organizationId } = await params

    // Verify user is member of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { sidebarConfig: true },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    // Return config or default
    const config = organization.sidebarConfig || DEFAULT_SIDEBAR_CONFIG

    return NextResponse.json({
      config,
      isDefault: !organization.sidebarConfig,
    })
  } catch (error) {
    console.error("Error fetching sidebar config:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: organizationId } = await params
    const body = await req.json()
    const { config } = body

    // Verify user is owner of this organization
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                role: "OWNER",
              },
            },
          },
        ],
      },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Nie masz uprawnień do edycji ustawień zespołu" },
        { status: 403 }
      )
    }

    // Validate config structure
    if (!Array.isArray(config)) {
      return NextResponse.json({ error: "Invalid config format" }, { status: 400 })
    }

    // Update organization with new sidebar config
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        sidebarConfig: config,
      },
      select: { sidebarConfig: true },
    })

    return NextResponse.json({
      config: updated.sidebarConfig,
      isDefault: false,
    })
  } catch (error) {
    console.error("Error updating sidebar config:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
