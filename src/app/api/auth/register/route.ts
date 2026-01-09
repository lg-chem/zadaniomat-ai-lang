import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import prisma from "@/lib/prisma"
import { PrismaClient } from "@prisma/client"

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

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

    // Use transaction to ensure all operations succeed or fail together
    const user = await prisma.$transaction(async (tx: TransactionClient) => {
      // Create user with default settings and gamification
      const newUser = await tx.user.create({
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
      await tx.category.createMany({
        data: [
          { userId: newUser.id, name: "Praca", color: "#3b82f6", workspaceType: "WORK", order: 0 },
          { userId: newUser.id, name: "Spotkania", color: "#8b5cf6", workspaceType: "WORK", order: 1 },
          { userId: newUser.id, name: "Rozwój", color: "#10b981", workspaceType: "WORK", isStrategic: true, order: 2 },
          { userId: newUser.id, name: "Zdrowie", color: "#ef4444", workspaceType: "PRIVATE", order: 0 },
          { userId: newUser.id, name: "Relacje", color: "#f59e0b", workspaceType: "PRIVATE", order: 1 },
          { userId: newUser.id, name: "Hobby", color: "#ec4899", workspaceType: "PRIVATE", order: 2 },
        ],
      })

      return newUser
    })

    return NextResponse.json(
      { message: "Konto zostało utworzone", userId: user.id },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Registration error:", error)

    // Handle specific Prisma errors by checking error properties
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as { code: string }
      if (prismaError.code === "P2002") {
        return NextResponse.json(
          { error: "Użytkownik z tym emailem już istnieje" },
          { status: 400 }
        )
      }
      if (prismaError.code === "P2003") {
        return NextResponse.json(
          { error: "Błąd integralności danych" },
          { status: 400 }
        )
      }
    }

    // Check for database connection errors
    if (error && typeof error === "object" && "name" in error) {
      const namedError = error as { name: string; message?: string }
      if (namedError.name === "PrismaClientInitializationError") {
        console.error("Database connection error:", namedError.message)
        return NextResponse.json(
          { error: "Błąd połączenia z bazą danych" },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      { error: "Wystąpił błąd podczas rejestracji" },
      { status: 500 }
    )
  }
}
