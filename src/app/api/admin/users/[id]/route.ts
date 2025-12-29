import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN"
const UserRoleValues: UserRole[] = ["USER", "ADMIN", "SUPER_ADMIN"]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { isApproved, role } = body

    // Prevent admin from changing their own role
    if (id === session.user.id && role) {
      return NextResponse.json(
        { error: "Nie możesz zmienić własnej roli" },
        { status: 400 }
      )
    }

    // Only SUPER_ADMIN can change roles
    if (role && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Tylko Super Admin może zmieniać role" },
        { status: 403 }
      )
    }

    const updateData: { isApproved?: boolean; role?: UserRole } = {}
    if (typeof isApproved === "boolean") {
      updateData.isApproved = isApproved
    }
    if (role && UserRoleValues.includes(role)) {
      updateData.role = role as UserRole
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        createdAt: true,
        image: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only SUPER_ADMIN can delete users
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Prevent deleting yourself
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Nie możesz usunąć własnego konta" },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
