import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { hash, compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

// PATCH - Change own password (for logged in users)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Wymagane jest obecne i nowe hasło" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Nowe hasło musi mieć minimum 6 znaków" },
        { status: 400 }
      )
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    })

    if (!user?.password) {
      return NextResponse.json(
        { error: "Nie można zmienić hasła dla tego konta" },
        { status: 400 }
      )
    }

    // Verify current password
    const isPasswordValid = await compare(currentPassword, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Obecne hasło jest nieprawidłowe" },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ success: true, message: "Hasło zostało zmienione" })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { error: "Wystąpił błąd podczas zmiany hasła" },
      { status: 500 }
    )
  }
}
