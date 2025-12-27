"use client"

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react"
import { Plus, Trash2, Star, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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

  // Inline editing state for new row
  const [newRow, setNewRow] = useState({
    name: "",
    color: COLORS[0],
    isStrategic: false,
  })
  const [isAddingNew, setIsAddingNew] = useState(false)
  const newRowRef = useRef<HTMLInputElement>(null)

  // Editing existing row
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

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

  const handleCreateCategory = async () => {
    if (!newRow.name.trim()) return

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRow,
          workspaceType: workspace,
        }),
      })
      if (res.ok) {
        fetchCategories()
        setNewRow({ name: "", color: COLORS[0], isStrategic: false })
        setIsAddingNew(false)
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

  const handleUpdateColor = async (category: Category, color: string) => {
    try {
      await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      })
      fetchCategories()
    } catch (error) {
      console.error("Error updating category:", error)
    }
  }

  const handleStartEdit = (category: Category) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const handleSaveEdit = async (categoryId: string) => {
    if (!editingName.trim()) {
      setEditingId(null)
      return
    }

    try {
      await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      })
      fetchCategories()
      setEditingId(null)
    } catch (error) {
      console.error("Error updating category:", error)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
    if (e.key === "Escape") {
      setEditingId(null)
      setIsAddingNew(false)
      setNewRow({ name: "", color: COLORS[0], isStrategic: false })
    }
  }

  const handleAddRowClick = () => {
    setIsAddingNew(true)
    setTimeout(() => newRowRef.current?.focus(), 0)
  }

  // Sort: strategic first, then by name
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.isStrategic !== b.isStrategic) return b.isStrategic ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Ustawienia</h1>
        <p className="text-muted-foreground">
          Zarządzaj kategoriami i konfiguracją
        </p>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kategorie</CardTitle>
          <CardDescription>
            Kategorie strategiczne mogą mieć przypisane cele okresowe. Kliknij w nazwę aby edytować.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Ładowanie...</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[60px_1fr_120px_60px] gap-2 p-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
                <div>Kolor</div>
                <div>Nazwa kategorii</div>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  Strategiczna
                </div>
                <div></div>
              </div>

              {/* Existing Categories */}
              {sortedCategories.map((category) => (
                <div
                  key={category.id}
                  className="grid grid-cols-[60px_1fr_120px_60px] gap-2 p-3 border-b last:border-b-0 items-center hover:bg-muted/30 transition-colors"
                >
                  {/* Color picker */}
                  <div className="relative group">
                    <div
                      className="h-6 w-6 rounded-full cursor-pointer border-2 border-transparent hover:border-foreground/20 transition-all"
                      style={{ backgroundColor: category.color }}
                    />
                    <div className="absolute left-0 top-8 z-10 hidden group-hover:flex flex-wrap gap-1 p-2 bg-popover border rounded-lg shadow-lg w-[140px]">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`h-5 w-5 rounded-full border transition-all ${
                            category.color === color
                              ? "border-foreground scale-110"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleUpdateColor(category, color)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    {editingId === category.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, () => handleSaveEdit(category.id))}
                          onBlur={() => handleSaveEdit(category.id)}
                          className="h-8"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div
                        className="cursor-text px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-2"
                        onClick={() => handleStartEdit(category)}
                      >
                        {category.name}
                        {category.isStrategic && (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Strategic switch */}
                  <div className="flex justify-center">
                    <Switch
                      checked={category.isStrategic}
                      onCheckedChange={() => handleToggleStrategic(category)}
                    />
                  </div>

                  {/* Delete */}
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* New Row */}
              {isAddingNew ? (
                <div className="grid grid-cols-[60px_1fr_120px_60px] gap-2 p-3 items-center bg-primary/5">
                  {/* Color picker for new */}
                  <div className="relative group">
                    <div
                      className="h-6 w-6 rounded-full cursor-pointer border-2 border-transparent hover:border-foreground/20 transition-all"
                      style={{ backgroundColor: newRow.color }}
                    />
                    <div className="absolute left-0 top-8 z-10 hidden group-hover:flex flex-wrap gap-1 p-2 bg-popover border rounded-lg shadow-lg w-[140px]">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`h-5 w-5 rounded-full border transition-all ${
                            newRow.color === color
                              ? "border-foreground scale-110"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewRow({ ...newRow, color })}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Name input */}
                  <Input
                    ref={newRowRef}
                    placeholder="Wpisz nazwę kategorii..."
                    value={newRow.name}
                    onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, handleCreateCategory)}
                    className="h-8"
                  />

                  {/* Strategic switch */}
                  <div className="flex justify-center">
                    <Switch
                      checked={newRow.isStrategic}
                      onCheckedChange={(checked: boolean) =>
                        setNewRow({ ...newRow, isStrategic: checked })
                      }
                    />
                  </div>

                  {/* Save button */}
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleCreateCategory}
                      disabled={!newRow.name.trim()}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleAddRowClick}
                  className="w-full p-3 text-left text-muted-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Dodaj kategorię...
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
