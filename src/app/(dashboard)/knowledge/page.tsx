"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  Search,
  FolderOpen,
  FolderPlus,
  Star,
  StarOff,
  ChevronRight,
  ChevronDown,
  Link2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspaceStore } from "@/stores/workspace-store"

interface StrategicCategory {
  id: string
  name: string
  color: string
}

interface KnowledgeCategory {
  id: string
  name: string
  description?: string | null
  color: string
  icon?: string | null
  isDefault: boolean
  parentId?: string | null
  linkedCategoryId?: string | null
  linkedCategory?: StrategicCategory | null
  children?: KnowledgeCategory[]
  _count: {
    entries: number
  }
}

interface KnowledgeEntry {
  id: string
  title: string
  content: string
  isImportant: boolean
  createdAt: string
  updatedAt: string
  category: KnowledgeCategory
}

// Recursive function to count all entries in category and children
function getTotalEntries(category: KnowledgeCategory): number {
  let total = category._count.entries
  if (category.children) {
    for (const child of category.children) {
      total += getTotalEntries(child)
    }
  }
  return total
}

// Flatten categories for select dropdown
function flattenCategories(categories: KnowledgeCategory[], prefix = ""): { id: string; name: string; color: string }[] {
  const result: { id: string; name: string; color: string }[] = []
  for (const cat of categories) {
    result.push({ id: cat.id, name: prefix + cat.name, color: cat.color })
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children, prefix + "— "))
    }
  }
  return result
}

export default function KnowledgePage() {
  const { workspace } = useWorkspaceStore()
  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [strategicCategories, setStrategicCategories] = useState<StrategicCategory[]>([])
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Dialogs
  const [showEntryDialog, setShowEntryDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null)
  const [editingCategory, setEditingCategory] = useState<KnowledgeCategory | null>(null)

  // Forms
  const [entryForm, setEntryForm] = useState({
    title: "",
    content: "",
    categoryId: "",
    isImportant: false,
  })
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    parentId: "",
    linkedCategoryId: "",
  })

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/knowledge/categories?workspace=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
        setStrategicCategories(data.strategicCategories || [])
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }, [workspace])

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams({ workspace })
      if (selectedCategory) params.append("categoryId", selectedCategory)
      if (searchQuery) params.append("search", searchQuery)

      const res = await fetch(`/api/knowledge/entries?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch (error) {
      console.error("Error fetching entries:", error)
    } finally {
      setIsLoading(false)
    }
  }, [workspace, selectedCategory, searchQuery])

  useEffect(() => {
    setIsLoading(true)
    fetchCategories()
    fetchEntries()
  }, [fetchCategories, fetchEntries])

  // Toggle expand/collapse for categories
  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  // Entry handlers
  const handleCreateEntry = async () => {
    if (!entryForm.title.trim() || !entryForm.content.trim() || !entryForm.categoryId) return

    try {
      const res = await fetch("/api/knowledge/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entryForm,
          workspace,
        }),
      })
      if (res.ok) {
        fetchEntries()
        fetchCategories()
        setShowEntryDialog(false)
        setEntryForm({ title: "", content: "", categoryId: "", isImportant: false })
      }
    } catch (error) {
      console.error("Error creating entry:", error)
    }
  }

  const handleUpdateEntry = async () => {
    if (!editingEntry || !entryForm.title.trim() || !entryForm.content.trim()) return

    try {
      const res = await fetch(`/api/knowledge/entries/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryForm),
      })
      if (res.ok) {
        fetchEntries()
        setEditingEntry(null)
        setShowEntryDialog(false)
        setEntryForm({ title: "", content: "", categoryId: "", isImportant: false })
      }
    } catch (error) {
      console.error("Error updating entry:", error)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten wpis?")) return

    try {
      await fetch(`/api/knowledge/entries/${id}`, { method: "DELETE" })
      fetchEntries()
      fetchCategories()
    } catch (error) {
      console.error("Error deleting entry:", error)
    }
  }

  const handleToggleImportant = async (entry: KnowledgeEntry) => {
    try {
      await fetch(`/api/knowledge/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isImportant: !entry.isImportant }),
      })
      fetchEntries()
    } catch (error) {
      console.error("Error toggling important:", error)
    }
  }

  const handleStartEditEntry = (entry: KnowledgeEntry) => {
    setEditingEntry(entry)
    setEntryForm({
      title: entry.title,
      content: entry.content,
      categoryId: entry.category.id,
      isImportant: entry.isImportant,
    })
    setShowEntryDialog(true)
  }

  // Category handlers
  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) return

    try {
      const res = await fetch("/api/knowledge/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name,
          description: categoryForm.description,
          color: categoryForm.color,
          workspace,
          parentId: categoryForm.parentId || undefined,
          linkedCategoryId: categoryForm.linkedCategoryId || undefined,
        }),
      })
      if (res.ok) {
        fetchCategories()
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", description: "", color: "#6366f1", parentId: "", linkedCategoryId: "" })
        setEditingCategory(null)
      }
    } catch (error) {
      console.error("Error creating category:", error)
    }
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryForm.name.trim()) return

    try {
      const res = await fetch(`/api/knowledge/categories/${editingCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name,
          description: categoryForm.description,
          color: categoryForm.color,
          linkedCategoryId: categoryForm.linkedCategoryId || null,
        }),
      })
      if (res.ok) {
        fetchCategories()
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", description: "", color: "#6366f1", parentId: "", linkedCategoryId: "" })
        setEditingCategory(null)
      }
    } catch (error) {
      console.error("Error updating category:", error)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę kategorię i wszystkie jej wpisy?")) return

    try {
      await fetch(`/api/knowledge/categories/${id}`, { method: "DELETE" })
      fetchCategories()
      if (selectedCategory === id) {
        setSelectedCategory(null)
      }
      fetchEntries()
    } catch (error) {
      console.error("Error deleting category:", error)
    }
  }

  const handleStartEditCategory = (category: KnowledgeCategory) => {
    setEditingCategory(category)
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      color: category.color,
      parentId: category.parentId || "",
      linkedCategoryId: category.linkedCategoryId || "",
    })
    setShowCategoryDialog(true)
  }

  const openNewCategoryDialog = (parentId?: string) => {
    setEditingCategory(null)
    setCategoryForm({
      name: "",
      description: "",
      color: "#6366f1",
      parentId: parentId || "",
      linkedCategoryId: "",
    })
    setShowCategoryDialog(true)
  }

  const openNewEntryDialog = (categoryId?: string) => {
    setEditingEntry(null)
    const flatCats = flattenCategories(categories)
    setEntryForm({
      title: "",
      content: "",
      categoryId: categoryId || flatCats[0]?.id || "",
      isImportant: false,
    })
    setShowEntryDialog(true)
  }

  // Recursive category renderer
  const renderCategory = (category: KnowledgeCategory, depth = 0) => {
    const hasChildren = category.children && category.children.length > 0
    const isExpanded = expandedCategories.has(category.id)
    const totalEntries = getTotalEntries(category)

    return (
      <div key={category.id}>
        <div
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group ${
            selectedCategory === category.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <div
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={() => {
              if (hasChildren) toggleExpanded(category.id)
              setSelectedCategory(selectedCategory === category.id ? null : category.id)
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              <div className="w-4" />
            )}
            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
            <span className="font-medium text-sm truncate">{category.name}</span>
            <Badge variant="secondary" className="text-xs flex-shrink-0">{totalEntries}</Badge>
            {category.linkedCategory && (
              <span title={`Powiązano z: ${category.linkedCategory.name}`}>
                <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                openNewCategoryDialog(category.id)
              }}
              title="Dodaj podkategorię"
            >
              <FolderPlus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                handleStartEditCategory(category)
              }}
              title="Edytuj kategorię"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            {!category.isDefault && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteCategory(category.id)
                }}
                title="Usuń kategorię"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {category.children!.map(child => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // Stats
  const flatCats = flattenCategories(categories)
  const totalEntries = categories.reduce((sum, cat) => sum + getTotalEntries(cat), 0)
  const importantEntries = entries.filter((e) => e.isImportant).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7" />
            Baza Wiedzy
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {workspace === "WORK" ? "Encyklopedia firmowa" : "Osobista baza wiedzy"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNewCategoryDialog()}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Nowa kategoria
          </Button>
          <Button onClick={() => openNewEntryDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nowy wpis
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-8 py-4">
          <div>
            <div className="text-sm text-muted-foreground">Kategorie</div>
            <div className="text-2xl font-bold">{flatCats.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Wpisy</div>
            <div className="text-2xl font-bold">{totalEntries}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Ważne</div>
            <div className="text-2xl font-bold text-yellow-500">{importantEntries}</div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj w bazie wiedzy..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={selectedCategory || "all"}
          onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Wszystkie kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kategorie</SelectItem>
            {flatCats.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Categories sidebar */}
        <div className="lg:col-span-1 space-y-1">
          <h3 className="font-semibold text-sm text-muted-foreground mb-3">KATEGORIE</h3>
          {categories.map((cat) => renderCategory(cat))}

          {/* Strategic categories section */}
          {strategicCategories.length > 0 && (
            <>
              <div className="pt-4 mt-4 border-t">
                <h4 className="font-semibold text-xs text-muted-foreground mb-2">STRATEGICZNE</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Możesz powiązać kategorie wiedzy z kategoriami strategicznymi
                </p>
                <div className="flex flex-wrap gap-1">
                  {strategicCategories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: cat.color, color: cat.color }}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Entries list */}
        <div className="lg:col-span-3 space-y-3">
          {entries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Brak wpisów</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchQuery
                    ? "Nie znaleziono wpisów pasujących do wyszukiwania"
                    : "Dodaj pierwszy wpis do bazy wiedzy"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => openNewEntryDialog(selectedCategory || undefined)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj wpis
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            entries.map((entry) => (
              <Card key={entry.id} className={entry.isImportant ? "border-yellow-500/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {entry.isImportant && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleToggleImportant(entry)}
                        title={entry.isImportant ? "Usuń z ważnych" : "Oznacz jako ważne"}
                      >
                        {entry.isImportant ? (
                          <StarOff className="h-4 w-4" />
                        ) : (
                          <Star className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleStartEditEntry(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground mb-3">
                    {entry.content}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      style={{ borderColor: entry.category.color, color: entry.category.color }}
                    >
                      {entry.category.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Zaktualizowano: {new Date(entry.updatedAt).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Entry Dialog */}
      <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edytuj wpis" : "Nowy wpis"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Tytuł</Label>
              <Input
                value={entryForm.title}
                onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
                placeholder="np. Procedura obsługi reklamacji"
              />
            </div>

            <div>
              <Label>Kategoria</Label>
              <Select
                value={entryForm.categoryId}
                onValueChange={(v) => setEntryForm({ ...entryForm, categoryId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {flatCats.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Treść</Label>
              <Textarea
                value={entryForm.content}
                onChange={(e) => setEntryForm({ ...entryForm, content: e.target.value })}
                placeholder="Opisz szczegółowo..."
                rows={8}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isImportant"
                checked={entryForm.isImportant}
                onChange={(e) => setEntryForm({ ...entryForm, isImportant: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isImportant" className="cursor-pointer">
                Oznacz jako ważne
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEntryDialog(false)}>
              Anuluj
            </Button>
            <Button
              onClick={editingEntry ? handleUpdateEntry : handleCreateEntry}
              disabled={!entryForm.title.trim() || !entryForm.content.trim() || !entryForm.categoryId}
            >
              {editingEntry ? "Zapisz zmiany" : "Dodaj wpis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edytuj kategorię" : categoryForm.parentId ? "Nowa podkategoria" : "Nowa kategoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="np. Marketing"
              />
            </div>

            <div>
              <Label>Opis (opcjonalnie)</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Krótki opis kategorii"
              />
            </div>

            <div>
              <Label>Kolor</Label>
              <div className="flex gap-2 mt-2">
                {["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#06b6d4", "#ec4899"].map(
                  (color) => (
                    <button
                      key={color}
                      className={`h-8 w-8 rounded-full ${
                        categoryForm.color === color ? "ring-2 ring-offset-2 ring-primary" : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setCategoryForm({ ...categoryForm, color })}
                    />
                  )
                )}
              </div>
            </div>

            {strategicCategories.length > 0 && (
              <div>
                <Label>Powiąż z kategorią strategiczną (opcjonalnie)</Label>
                <Select
                  value={categoryForm.linkedCategoryId || "none"}
                  onValueChange={(v) => setCategoryForm({ ...categoryForm, linkedCategoryId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak powiązania</SelectItem>
                    {strategicCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCategoryDialog(false)
              setEditingCategory(null)
            }}>
              Anuluj
            </Button>
            <Button
              onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
              disabled={!categoryForm.name.trim()}
            >
              {editingCategory ? "Zapisz zmiany" : "Utwórz kategorię"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
