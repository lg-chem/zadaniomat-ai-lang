import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { setKeyResultValue } from "@/lib/quarter-data"

const updateValueSchema = z.object({
  currentValue: z.number(),
})

// Quick update of a key result value (kept in history)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keyResult = await prisma.keyResult.findFirst({
      where: { id: params.id, goal: { userId: session.user.id } },
    })
    if (!keyResult) {
      return NextResponse.json({ error: "Rezultat nie znaleziony" }, { status: 404 })
    }

    const parsed = updateValueSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowa wartość" }, { status: 400 })
    }

    await prisma.$transaction((tx) => setKeyResultValue(tx, keyResult, parsed.data.currentValue))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating key result:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
