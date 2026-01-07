import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a member of any organization with restrictedToWork = true
    const restrictedMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        restrictedToWork: true,
      },
    })

    return NextResponse.json({
      restrictedToWork: !!restrictedMembership,
    })
  } catch (error) {
    console.error("Error fetching user restrictions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
