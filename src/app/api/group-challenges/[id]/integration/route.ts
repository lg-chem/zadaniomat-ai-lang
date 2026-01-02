import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// PATCH - Update member's integration settings
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { linkedType, linkedHabitId, minSteps, sportActivityType, minDuration } = body

    // Find user's membership
    const membership = await prisma.groupChallengeMember.findUnique({
      where: {
        challengeId_userId: {
          challengeId: id,
          userId: session.user.id,
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Nie jesteś członkiem tego wyzwania" },
        { status: 403 }
      )
    }

    // Update integration settings
    const updated = await prisma.groupChallengeMember.update({
      where: { id: membership.id },
      data: {
        linkedType: linkedType || "NONE",
        linkedHabitId: linkedHabitId || null,
        minSteps: minSteps ? parseInt(minSteps) : null,
        sportActivityType: sportActivityType || null,
        minDuration: minDuration ? parseInt(minDuration) : null,
      },
    })

    return NextResponse.json({
      success: true,
      linkedType: updated.linkedType,
      linkedHabitId: updated.linkedHabitId,
      minSteps: updated.minSteps,
      sportActivityType: updated.sportActivityType,
      minDuration: updated.minDuration,
    })
  } catch (error) {
    console.error("Error updating integration settings:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
