"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Trash2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useWorkspaceStore } from "@/stores/workspace-store"

interface Category {
  id: string
  name: string
  color: string
  icon?: string | null
  isStrategic: boolean
  workspaceType: string
}

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b",
  "#10b981", "#06b6d4", "#6366f1", "#84cc16", "#f97316",
]

export default function SettingsPage() {
  const { workspace } = useWorkspaceStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCategory, setNewCategory] = useState({
    name: "",
    color: COLORS[0],
    isStrategic: false,
  })

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/categories?workspace=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    } finally {
      setIsLoading(false)
    }
  }, [workspace])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCategory,
          workspaceType: workspace,
        }),
      })
      if (res.ok) {
        fetchCategories()
        setShowCreate(false)
        setNewCategory({ name: "", color: COLORS[0], isStrategic: false })
      }
    } catch (error) {
      console.error("Error creating category:", error)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę kategorię?")) return
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchCategories()
      }
    } catch (error) {
      console.error("Error deleting category:", error)
    }
  }

  const handleToggleStrategic = async (category: Category) => {
    try {
      await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStrategic: !category.isStrategic }),
      })
      fetchCategories()
    } catch (error) {
      console.error("Error updating category:", error)
    }
  }

  const strategicCategories = categories.filter((c) => c.isStrategic)
  const regularCategories = categories.filter((c) => !c.isStrategic)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Ustawienia</h1>
        <p className="text-muted-foreground">
          Zarządzaj kategoriami i konfiguracją
        </p>
      </div>

      {/* Categories Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kategorie</CardTitle>
              <CardDescription>
                Kategorie strategiczne mogą mieć przypisane cele okresowe
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nowa kategoria
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-muted-foreground">Ładowanie...</p>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Brak kategorii. Dodaj pierwszą!
            </p>
          ) : (
            <>
              {/* Strategic Categories */}
              {strategicCategories.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Kategorie strategiczne
                  </h3>
                  <div className="space-y-2">
                    {strategicCategories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="font-medium">{category.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Strategiczna
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={category.isStrategic}
                            onCheckedChange={() => handleToggleStrategic(category)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {strategicCategories.length > 0 && regularCategories.length > 0 && (
                <Separator />
              )}

              {/* Regular Categories */}
              {regularCategories.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Pozostałe kategorie
                  </h3>
                  <div className="space-y-2">
                    {regularCategories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={category.isStrategic}
                            onCheckedChange={() => handleToggleStrategic(category)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Category Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowa kategoria</DialogTitle>
            <DialogDescription>
              Dodaj kategorię dla zadań i celów
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="categoryName">Nazwa kategorii</Label>
                <Input
                  id="categoryName"
                  placeholder="np. Firma X, Rozwój osobisty, Zdrowie"
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Kolor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        newCategory.color === color
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        setNewCategory({ ...newCategory, color })
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Kategoria strategiczna</Label>
                  <p className="text-sm text-muted-foreground">
                    Umożliwia przypisywanie celów okresowych
                  </p>
                </div>
                <Switch
                  checked={newCategory.isStrategic}
                  onCheckedChange={(checked) =>
                    setNewCategory({ ...newCategory, isStrategic: checked })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Anuluj
              </Button>
              <Button type="submit">Dodaj kategorię</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
