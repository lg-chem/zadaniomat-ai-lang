import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// DELETE - Remove member from challenge (creator only) or leave challenge
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "Wymagane jest ID użytkownika" },
        { status: 400 }
      )
    }

    const challenge = await prisma.groupChallenge.findUnique({
      where: { id },
    })

    if (!challenge) {
      return NextResponse.json({ error: "Wyzwanie nie znalezione" }, { status: 404 })
    }

    // Check if user is trying to leave or kick someone
    if (userId === session.user.id) {
      // User wants to leave
      if (challenge.creatorId === session.user.id) {
        return NextResponse.json(
          { error: "Twórca nie może opuścić wyzwania. Usuń wyzwanie zamiast tego." },
          { status: 400 }
        )
      }

      await prisma.groupChallengeMember.delete({
        where: {
          challengeId_userId: {
            challengeId: id,
            userId: session.user.id,
          },
        },
      })

      return NextResponse.json({ success: true, left: true })
    } else {
      // User wants to kick someone (creator only)
      if (challenge.creatorId !== session.user.id) {
        return NextResponse.json(
          { error: "Tylko twórca może usuwać członków" },
          { status: 403 }
        )
      }

      if (userId === challenge.creatorId) {
        return NextResponse.json(
          { error: "Nie można usunąć twórcy wyzwania" },
          { status: 400 }
        )
      }

      await prisma.groupChallengeMember.delete({
        where: {
          challengeId_userId: {
            challengeId: id,
            userId,
          },
        },
      })

      return NextResponse.json({ success: true, kicked: true })
    }
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
