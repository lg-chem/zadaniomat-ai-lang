/**
 * Awaryjny reset hasła (gdy nie da się zalogować do panelu).
 *
 * Wymaga ustawionego DATABASE_URL (np. w .env lub jako zmienna środowiskowa).
 *
 * Użycie:
 *   node scripts/reset-password.js --list
 *   node scripts/reset-password.js <email> <noweHaslo>
 *   node scripts/reset-password.js <email> <noweHaslo> --make-admin
 *
 * Przykład:
 *   node scripts/reset-password.js admin@example.com MojeNoweHaslo123
 */

const readline = require("readline")
const { PrismaClient } = require("@prisma/client")
const { hash } = require("bcryptjs")

// Wczytaj .env / .env.local jeśli istnieją (bez dodatkowych zależności)
loadEnvFiles([".env.local", ".env"])

const BCRYPT_ROUNDS = 12 // musi być zgodne z src/app/api/auth/register/route.ts

async function main() {
  const args = process.argv.slice(2)

  if (!process.env.DATABASE_URL) {
    fail(
      "Brak DATABASE_URL. Ustaw go w .env albo uruchom:\n" +
        '  DATABASE_URL="postgresql://..." node scripts/reset-password.js ...'
    )
  }

  const prisma = new PrismaClient()

  try {
    if (args.includes("--list") || args.length === 0) {
      const users = await prisma.user.findMany({
        select: { email: true, name: true, role: true, isApproved: true },
        orderBy: { createdAt: "asc" },
      })

      if (users.length === 0) {
        console.log("Brak użytkowników w bazie.")
      } else {
        console.log(`Użytkownicy (${users.length}):\n`)
        for (const u of users) {
          const approved = u.isApproved ? "zatwierdzony" : "oczekuje"
          console.log(`  ${u.email.padEnd(35)} ${u.role.padEnd(12)} ${approved}`)
        }
      }

      if (args.length === 0) {
        console.log(
          "\nAby zmienić hasło:\n  node scripts/reset-password.js <email> <noweHaslo> [--make-admin]"
        )
      }
      return
    }

    const makeAdmin = args.includes("--make-admin")
    const positional = args.filter((a) => !a.startsWith("--"))
    const email = positional[0]
    let password = positional[1]

    if (!email) {
      fail("Podaj email. Przykład: node scripts/reset-password.js admin@example.com NoweHaslo123")
    }

    if (!password) {
      password = await prompt("Nowe hasło: ")
    }

    if (!password || password.length < 6) {
      fail("Hasło musi mieć minimum 6 znaków.")
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true },
    })

    if (!user) {
      fail(
        `Nie znaleziono użytkownika o emailu "${email}".\n` +
          "Sprawdź listę: node scripts/reset-password.js --list"
      )
    }

    const hashedPassword = await hash(password, BCRYPT_ROUNDS)

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isApproved: true,
        ...(makeAdmin ? { role: "SUPER_ADMIN" } : {}),
      },
      select: { email: true, role: true },
    })

    console.log(`\n✅ Hasło dla ${updated.email} zostało zmienione.`)
    console.log(`   Rola: ${updated.role}`)
    console.log("   Możesz się teraz zalogować nowym hasłem.")
  } finally {
    await prisma.$disconnect()
  }
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function loadEnvFiles(files) {
  const fs = require("fs")
  const path = require("path")

  for (const file of files) {
    const fullPath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(fullPath)) continue

    const content = fs.readFileSync(fullPath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      const eq = trimmed.indexOf("=")
      if (eq === -1) continue

      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (!(key in process.env)) process.env[key] = value
    }
  }
}

function fail(message) {
  console.error(`\n❌ ${message}`)
  process.exit(1)
}

main().catch((error) => {
  console.error("\n❌ Błąd:", error.message)
  process.exit(1)
})
