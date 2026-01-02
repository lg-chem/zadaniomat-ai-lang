import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// PATCH - Accept or decline invitation
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
    const { action } = body // "accept" or "decline"

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Wymagana akcja: accept lub decline" },
        { status: 400 }
      )
    }

    const invitation = await prisma.groupChallengeInvitation.findUnique({
      where: { id },
      include: {
        challenge: true,
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Zaproszenie nie znalezione" }, { status: 404 })
    }

    if (invitation.userId !== session.user.id) {
      return NextResponse.json(
        { error: "To nie jest Twoje zaproszenie" },
        { status: 403 }
      )
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "To zaproszenie zostało już obsłużone" },
        { status: 400 }
      )
    }

    if (action === "accept") {
      // Accept invitation - add user as member and update invitation
      await prisma.$transaction([
        prisma.groupChallengeMember.create({
          data: {
            challengeId: invitation.challengeId,
            userId: session.user.id,
            role: "MEMBER",
          },
        }),
        prisma.groupChallengeInvitation.update({
          where: { id },
          data: {
            status: "ACCEPTED",
            respondedAt: new Date(),
          },
        }),
      ])

      return NextResponse.json({
        success: true,
        action: "accepted",
        challengeId: invitation.challengeId,
      })
    } else {
      // Decline invitation
      await prisma.groupChallengeInvitation.update({
        where: { id },
        data: {
          status: "DECLINED",
          respondedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        action: "declined",
      })
    }
  } catch (error) {
    console.error("Error responding to invitation:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
