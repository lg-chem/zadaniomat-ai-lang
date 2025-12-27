import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email i hasło są wymagane" },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Użytkownik z tym emailem już istnieje" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hash(password, 12)

    // Create user with default settings and gamification
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split("@")[0],
        settings: {
          create: {},
        },
        gamification: {
          create: {},
        },
      },
    })

    // Create default categories
    await prisma.category.createMany({
      data: [
        { userId: user.id, name: "Praca", color: "#3b82f6", workspaceType: "WORK", order: 0 },
        { userId: user.id, name: "Spotkania", color: "#8b5cf6", workspaceType: "WORK", order: 1 },
        { userId: user.id, name: "Rozwój", color: "#10b981", workspaceType: "WORK", isStrategic: true, order: 2 },
        { userId: user.id, name: "Zdrowie", color: "#ef4444", workspaceType: "PRIVATE", order: 0 },
        { userId: user.id, name: "Relacje", color: "#f59e0b", workspaceType: "PRIVATE", order: 1 },
        { userId: user.id, name: "Hobby", color: "#ec4899", workspaceType: "PRIVATE", order: 2 },
      ],
    })

    return NextResponse.json(
      { message: "Konto zostało utworzone", userId: user.id },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Wystąpił błąd podczas rejestracji" },
      { status: 500 }
    )
  }
}
