import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

// PATCH - Reset user password (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    // Check if user is admin
    const isAdmin =
      session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"

    if (!session?.user?.id || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { newPassword } = await request.json()

    if (!newPassword) {
      return NextResponse.json(
        { error: "Nowe hasło jest wymagane" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Hasło musi mieć minimum 6 znaków" },
        { status: 400 }
      )
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "Użytkownik nie istnieje" },
        { status: 404 }
      )
    }

    // Only SUPER_ADMIN can reset other admin's passwords
    if (
      (targetUser.role === "ADMIN" || targetUser.role === "SUPER_ADMIN") &&
      session.user.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Tylko Super Admin może zmieniać hasła innych adminów" },
        { status: 403 }
      )
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    })

    return NextResponse.json({
      success: true,
      message: `Hasło użytkownika ${targetUser.email} zostało zmienione`,
    })
  } catch (error) {
    console.error("Error resetting password:", error)
    return NextResponse.json(
      { error: "Wystąpił błąd podczas resetowania hasła" },
      { status: 500 }
    )
  }
}
