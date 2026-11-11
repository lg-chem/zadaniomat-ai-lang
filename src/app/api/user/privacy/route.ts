import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Per user - never rendered at build time
export const dynamic = "force-dynamic"

const mine = (userId: string) => ({ userId, isPublic: true })

// GET - how many of the user's private-tab entries other people can see ("Znajomi")
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const where = mine(session.user.id)

    const [habits, challenges, sportActivities, steps] = await Promise.all([
      prisma.habit.count({ where }),
      prisma.challenge.count({ where }),
      prisma.sportActivity.count({ where }),
      prisma.stepsEntry.count({ where }),
    ])

    return NextResponse.json({
      habits,
      challenges,
      sportActivities,
      steps,
      total: habits + challenges + sportActivities + steps,
    })
  } catch (error) {
    console.error("Error counting public entries:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - hides all of them: every habit, challenge, workout and steps day of the user becomes private
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const where = mine(session.user.id)
    const data = { isPublic: false }

    const [habits, challenges, sportActivities, steps] = await prisma.$transaction([
      prisma.habit.updateMany({ where, data }),
      prisma.challenge.updateMany({ where, data }),
      prisma.sportActivity.updateMany({ where, data }),
      prisma.stepsEntry.updateMany({ where, data }),
    ])

    return NextResponse.json({
      hidden: habits.count + challenges.count + sportActivities.count + steps.count,
    })
  } catch (error) {
    console.error("Error hiding public entries:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
