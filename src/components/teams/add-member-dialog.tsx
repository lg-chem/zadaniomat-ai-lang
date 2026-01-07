"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface Category {
  id: string
  name: string
  color: string
}

interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  categories: Category[]
  onSuccess: () => void
}

export function AddMemberDialog({
  open,
  onOpenChange,
  organizationId,
  categories,
  onSuccess,
}: AddMemberDialogProps) {
  const [email, setEmail] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/organizations/${organizationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          categoryIds: selectedCategories,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Wystąpił błąd")
        return
      }

      setEmail("")
      setSelectedCategories([])
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error adding member:", error)
      setError("Wystąpił błąd podczas dodawania członka")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodaj członka zespołu</DialogTitle>
          <DialogDescription>
            Podaj email użytkownika, którego chcesz dodać do zespołu
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email użytkownika</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pracownik@firma.pl"
                required
              />
            </div>

            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Przypisane kategorie (opcjonalnie)</Label>
                <p className="text-sm text-muted-foreground">
                  Wybierz kategorie, na których będzie pracował ten członek
                </p>
                <div className="space-y-2 mt-2">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-2">
                      <Checkbox
                        id={category.id}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <label
                        htmlFor={category.id}
                        className="text-sm flex items-center gap-2 cursor-pointer"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? "Dodawanie..." : "Dodaj członka"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
