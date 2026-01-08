import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Default sidebar items for employees
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
  // AI Chat tabs (prefixed with ai-tab-)
  { id: "ai-tab-general", label: "AI: Ogólny", enabled: true, order: 100 },
  { id: "ai-tab-daily_tasks", label: "AI: Zadania", enabled: true, order: 101 },
  { id: "ai-tab-sprint_goals", label: "AI: Sprint", enabled: true, order: 102 },
  { id: "ai-tab-period_goals", label: "AI: Okres", enabled: true, order: 103 },
]

// GET: Fetch employee sidebar config (for any user to know what they should see)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find any admin's settings with employeeSidebarConfig set
    const allAdminSettings = await prisma.userSettings.findMany({
      where: {
        user: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] }
        }
      },
      select: { employeeSidebarConfig: true }
    })

    // Find first one that has config set
    const adminSettings = allAdminSettings.find(s => s.employeeSidebarConfig !== null)

    let config = DEFAULT_SIDEBAR_CONFIG

    if (adminSettings?.employeeSidebarConfig && Array.isArray(adminSettings.employeeSidebarConfig)) {
      const existingConfig = adminSettings.employeeSidebarConfig as typeof DEFAULT_SIDEBAR_CONFIG
      // Start with existing config
      const mergedConfig = [...existingConfig]
      // Add any new default items that don't exist in saved config
      for (const defaultItem of DEFAULT_SIDEBAR_CONFIG) {
        const exists = existingConfig.some(item => item.id === defaultItem.id)
        if (!exists) {
          mergedConfig.push(defaultItem)
        }
      }
      config = mergedConfig
    }

    return NextResponse.json({
      config,
      isDefault: !adminSettings?.employeeSidebarConfig,
    })
  } catch (error) {
    console.error("Error fetching employee sidebar config:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH: Update employee sidebar config (admin only)
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { error: "Tylko administrator może zmieniać te ustawienia" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { config } = body

    // Validate config structure
    if (!Array.isArray(config)) {
      return NextResponse.json({ error: "Invalid config format" }, { status: 400 })
    }

    // Upsert user settings with the new config
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        employeeSidebarConfig: config,
      },
      create: {
        userId: session.user.id,
        employeeSidebarConfig: config,
      },
      select: { employeeSidebarConfig: true }
    })

    return NextResponse.json({
      config: settings.employeeSidebarConfig,
      isDefault: false,
    })
  } catch (error) {
    console.error("Error updating employee sidebar config:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
