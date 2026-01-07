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

    // Check user's restrictedToWork setting
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { restrictedToWork: true },
    })

    return NextResponse.json({
      restrictedToWork: user?.restrictedToWork ?? false,
    })
  } catch (error) {
    console.error("Error fetching user restrictions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
