"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPendingApproval, setIsPendingApproval] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsPendingApproval(false)
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error === "PENDING_APPROVAL") {
          setIsPendingApproval(true)
        } else {
          setError(result.error)
        }
      } else {
        router.push("/schedule")
        router.refresh()
      }
    } catch {
      setError("Wystąpił błąd podczas logowania")
    } finally {
      setIsLoading(false)
    }
  }

  if (isPendingApproval) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Oczekiwanie na zatwierdzenie</CardTitle>
          <CardDescription>
            Twoje konto zostało zarejestrowane, ale wymaga zatwierdzenia przez administratora.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Otrzymasz dostęp do aplikacji po zatwierdzeniu konta.</p>
          <p className="mt-2">Skontaktuj się z administratorem jeśli potrzebujesz szybszego dostępu.</p>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setIsPendingApproval(false)
              setEmail("")
              setPassword("")
            }}
          >
            Powrót do logowania
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Zadaniomat AI</CardTitle>
        <CardDescription>Zaloguj się do swojego konta</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="twoj@email.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Hasło
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Logowanie..." : "Zaloguj się"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Nie masz konta?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Zarejestruj się
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
