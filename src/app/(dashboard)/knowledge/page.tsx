"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import {
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  Search,
  Star,
  StarOff,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Target,
  Folder,
  Users,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
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
import useSWR from "swr"

interface KnowledgeCategory {
  id: string
  name: string
  color: string
  linkedCategoryId?: string | null
  parentId?: string | null
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
  visibility: "PRIVATE" | "TEAM"
  createdAt: string
  updatedAt: string
  category: KnowledgeCategory
  userId: string
  user?: {
    id: string
    name: string | null
  }
}

// Helper to count total entries in category tree
function getTotalEntries(category: KnowledgeCategory, entryCounts?: Map<string, number>): number {
  // If we have entry counts map, use it (for team-shared entries)
  const categoryCount = entryCounts?.get(category.id) ?? category._count.entries
  let total = categoryCount
  if (category.children) {
    for (const child of category.children) {
      total += getTotalEntries(child, entryCounts)
    }
  }
  return total
}

// Helper to flatten categories for select
function flattenCategories(categories: KnowledgeCategory[], prefix = ""): KnowledgeCategory[] {
  const result: KnowledgeCategory[] = []
  for (const cat of categories) {
    result.push({ ...cat, name: prefix + cat.name })
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children, prefix + "— "))
    }
  }
  return result
}

// Category item component
function CategoryItem({
  category,
  depth = 0,
  selectedCategory,
  expandedCategories,
  onSelect,
  onToggleExpand,
  onAddSubcategory,
  onEdit,
  onDelete,
  isStrategic = false,
  entryCounts,
}: {
  category: KnowledgeCategory
  depth?: number
  selectedCategory: string | null
  expandedCategories: Set<string>
  onSelect: (id: string | null) => void
  onToggleExpand: (id: string) => void
  onAddSubcategory: (parentId: string) => void
  onEdit: (category: KnowledgeCategory) => void
  onDelete: (id: string) => void
  isStrategic?: boolean
  entryCounts?: Map<string, number>
}) {
  const hasChildren = category.children && category.children.length > 0
  const isExpanded = expandedCategories.has(category.id)
  const totalEntriesCount = getTotalEntries(category, entryCounts)
  const isSelected = selectedCategory === category.id

  return (
    <div>
      <div
        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group ${
          isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <div
          className="flex items-center gap-2 flex-1 min-w-0"
          onClick={() => {
            if (hasChildren) onToggleExpand(category.id)
            onSelect(isSelected ? null : category.id)
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
          <div
            className="h-3 w-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <span className="font-medium text-sm truncate">{category.name}</span>
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {totalEntriesCount}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              onAddSubcategory(category.id)
            }}
            title="Dodaj podkategorię"
          >
            <FolderPlus className="h-3 w-3" />
          </Button>
          {!isStrategic && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(category)
                }}
                title="Edytuj"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(category.id)
                }}
                title="Usuń"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {category.children!.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              depth={depth + 1}
              selectedCategory={selectedCategory}
              expandedCategories={expandedCategories}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onAddSubcategory={onAddSubcategory}
              onEdit={onEdit}
              onDelete={onDelete}
              isStrategic={isStrategic}
              entryCounts={entryCounts}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CategoriesResponse {
  strategicCategories: KnowledgeCategory[]
  customCategories: KnowledgeCategory[]
  allCategories: KnowledgeCategory[]
}

export default function KnowledgePage() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const { workspace } = useWorkspaceStore()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // SWR for categories
  const { data: categoriesData, isLoading: categoriesLoading, mutate: mutateCategories } = useSWR<CategoriesResponse>(
    `/api/knowledge/categories?workspace=${workspace}`
  )

  const strategicCategories = categoriesData?.strategicCategories || []
  const customCategories = categoriesData?.customCategories || []
  const allCategories = categoriesData?.allCategories || []

  // Fetch ALL entries once, filter locally for instant category switching
  const entriesUrl = useMemo(() => {
    const params = new URLSearchParams({ workspace })
    if (searchQuery) params.append("search", searchQuery)
    return `/api/knowledge/entries?${params}`
  }, [workspace, searchQuery])

  // SWR for entries - fetch all, filter locally
  const { data: allEntries = [], isLoading: entriesLoading, mutate: mutateEntries } = useSWR<KnowledgeEntry[]>(entriesUrl)

  // Filter entries locally based on selected category (instant, no refetch)
  const entries = useMemo(() => {
    if (!selectedCategory) return allEntries
    return allEntries.filter(entry => entry.category?.id === selectedCategory)
  }, [allEntries, selectedCategory])

  const isLoading = categoriesLoading || entriesLoading

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
    visibility: "PRIVATE" as "PRIVATE" | "TEAM",
  })
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    parentId: "",
  })

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  // Entry handlers with optimistic updates
  const handleCreateEntry = async () => {
    if (!entryForm.title.trim() || !entryForm.content.trim() || !entryForm.categoryId) return

    const category = allCategories.find(c => c.id === entryForm.categoryId)
    const tempId = `temp-${Date.now()}`
    const optimisticEntry: KnowledgeEntry = {
      id: tempId,
      title: entryForm.title,
      content: entryForm.content,
      isImportant: entryForm.isImportant,
      visibility: entryForm.visibility,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: category || { id: entryForm.categoryId, name: "", color: "#6366f1", _count: { entries: 0 } },
      userId: currentUserId || "",
    }

    // Close dialog immediately
    setShowEntryDialog(false)
    const formData = { ...entryForm }
    setEntryForm({ title: "", content: "", categoryId: "", isImportant: false, visibility: "PRIVATE" })

    // Optimistic update
    mutateEntries(
      async (currentEntries) => {
        const res = await fetch("/api/knowledge/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, workspace }),
        })
        if (!res.ok) throw new Error("Failed to create entry")
        const newEntry = await res.json()
        toast.success("Wpis dodany")
        return [newEntry, ...(currentEntries || []).filter(e => e.id !== tempId)]
      },
      {
        optimisticData: (currentEntries) => [optimisticEntry, ...(currentEntries || [])],
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się dodać wpisu")
    })

    mutateCategories()
  }

  const handleUpdateEntry = async () => {
    if (!editingEntry || !entryForm.title.trim() || !entryForm.content.trim()) return

    const entryId = editingEntry.id
    const category = allCategories.find(c => c.id === entryForm.categoryId)
    const updatedEntry: KnowledgeEntry = {
      ...editingEntry,
      title: entryForm.title,
      content: entryForm.content,
      isImportant: entryForm.isImportant,
      visibility: entryForm.visibility,
      category: category || editingEntry.category,
      updatedAt: new Date().toISOString(),
    }

    // Close dialog immediately
    setEditingEntry(null)
    setShowEntryDialog(false)
    const formData = { ...entryForm }
    setEntryForm({ title: "", content: "", categoryId: "", isImportant: false, visibility: "PRIVATE" })

    // Optimistic update
    mutateEntries(
      async (currentEntries) => {
        const res = await fetch(`/api/knowledge/entries/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error("Failed to update entry")
        const serverEntry = await res.json()
        toast.success("Wpis zaktualizowany")
        return (currentEntries || []).map(e => e.id === entryId ? serverEntry : e)
      },
      {
        optimisticData: (currentEntries) => (currentEntries || []).map(e => e.id === entryId ? updatedEntry : e),
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się zaktualizować wpisu")
    })
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten wpis?")) return

    // Optimistic delete
    mutateEntries(
      async (currentEntries) => {
        const res = await fetch(`/api/knowledge/entries/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete entry")
        toast.success("Wpis usunięty")
        return (currentEntries || []).filter(e => e.id !== id)
      },
      {
        optimisticData: (currentEntries) => (currentEntries || []).filter(e => e.id !== id),
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się usunąć wpisu")
    })

    mutateCategories()
  }

  const handleToggleImportant = async (entry: KnowledgeEntry) => {
    const newImportant = !entry.isImportant

    // Optimistic toggle
    mutateEntries(
      async (currentEntries) => {
        const res = await fetch(`/api/knowledge/entries/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isImportant: newImportant }),
        })
        if (!res.ok) throw new Error("Failed to toggle important")
        return (currentEntries || []).map(e =>
          e.id === entry.id ? { ...e, isImportant: newImportant } : e
        )
      },
      {
        optimisticData: (currentEntries) => (currentEntries || []).map(e =>
          e.id === entry.id ? { ...e, isImportant: newImportant } : e
        ),
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się zmienić statusu")
    })
  }

  const handleStartEditEntry = (entry: KnowledgeEntry) => {
    setEditingEntry(entry)
    setEntryForm({
      title: entry.title,
      content: entry.content,
      categoryId: entry.category.id,
      isImportant: entry.isImportant,
      visibility: entry.visibility || "PRIVATE",
    })
    setShowEntryDialog(true)
  }

  const openNewEntryDialog = (categoryId?: string) => {
    setEditingEntry(null)
    setEntryForm({
      title: "",
      content: "",
      categoryId: categoryId || allCategories[0]?.id || "",
      isImportant: false,
      visibility: "PRIVATE",
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
        }),
      })
      if (res.ok) {
        mutateCategories()
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", description: "", color: "#6366f1", parentId: "" })
        setEditingCategory(null)
        toast.success("Kategoria utworzona")
      } else {
        toast.error("Nie udało się utworzyć kategorii")
      }
    } catch (error) {
      console.error("Error creating category:", error)
      toast.error("Błąd podczas tworzenia kategorii")
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
        }),
      })
      if (res.ok) {
        mutateCategories()
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", description: "", color: "#6366f1", parentId: "" })
        setEditingCategory(null)
        toast.success("Kategoria zaktualizowana")
      } else {
        toast.error("Nie udało się zaktualizować kategorii")
      }
    } catch (error) {
      console.error("Error updating category:", error)
      toast.error("Błąd podczas aktualizacji kategorii")
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę kategorię i wszystkie jej wpisy?")) return

    try {
      const res = await fetch(`/api/knowledge/categories/${id}`, { method: "DELETE" })
      if (res.ok) {
        mutateCategories()
        if (selectedCategory === id) {
          setSelectedCategory(null)
        }
        mutateEntries()
        toast.success("Kategoria usunięta")
      } else {
        toast.error("Nie udało się usunąć kategorii")
      }
    } catch (error) {
      console.error("Error deleting category:", error)
      toast.error("Błąd podczas usuwania kategorii")
    }
  }

  const handleStartEditCategory = (category: KnowledgeCategory) => {
    setEditingCategory(category)
    setCategoryForm({
      name: category.name,
      description: "",
      color: category.color,
      parentId: category.parentId || "",
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
    })
    setShowCategoryDialog(true)
  }

  // Build entry counts map for accurate counting (includes team-shared entries)
  // Team entries have the AUTHOR's KnowledgeCategory ID, not the viewer's
  // We need to map through linkedCategoryId to find the viewer's category
  // Use allEntries (unfiltered) for accurate counts
  const entryCounts = useMemo(() => {
    const counts = new Map<string, number>()

    // Build a map from linkedCategoryId -> viewer's KnowledgeCategory ID
    const linkedToViewerCat = new Map<string, string>()
    for (const cat of allCategories) {
      if (cat.linkedCategoryId) {
        linkedToViewerCat.set(cat.linkedCategoryId, cat.id)
      }
    }

    for (const entry of allEntries) {
      const entryLinkedCategoryId = entry.category?.linkedCategoryId

      if (entryLinkedCategoryId) {
        // This is a strategic category entry - map to viewer's category
        const viewerCatId = linkedToViewerCat.get(entryLinkedCategoryId)
        if (viewerCatId) {
          counts.set(viewerCatId, (counts.get(viewerCatId) || 0) + 1)
        }
      } else {
        // Custom category - use the entry's category ID directly
        const catId = entry.category?.id
        if (catId) {
          counts.set(catId, (counts.get(catId) || 0) + 1)
        }
      }
    }
    return counts
  }, [allEntries, allCategories])

  // Stats - use allEntries for total, entries (filtered) for current view
  const totalEntriesCountCount = allEntries.length
  const importantEntries = allEntries.filter((e) => e.isImportant).length

  // Flattened categories for select
  const flatCats = [
    ...flattenCategories(strategicCategories),
    ...flattenCategories(customCategories),
  ]

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
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
            <FolderPlus className="h-4 w-4 mr-2" />
            Nowa kategoria
          </Button>
          <Button onClick={() => openNewEntryDialog()} disabled={allCategories.length === 0}>
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
            <div className="text-2xl font-bold">{allCategories.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Wpisy</div>
            <div className="text-2xl font-bold">{totalEntriesCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Ważne</div>
            <div className="text-2xl font-bold text-yellow-500">{importantEntries}</div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj w bazie wiedzy..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Categories sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* All option */}
          <div
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
              selectedCategory === null ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
            }`}
            onClick={() => setSelectedCategory(null)}
          >
            <span className="font-medium text-sm">Wszystkie</span>
            <Badge variant="secondary" className="text-xs">
              {totalEntriesCount}
            </Badge>
          </div>

          {/* Strategic categories */}
          {strategicCategories.length > 0 && (
            <div>
              <h3 className="font-semibold text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Target className="h-3 w-3" />
                STRATEGICZNE
              </h3>
              <div className="space-y-0.5">
                {strategicCategories.map((cat) => (
                  <CategoryItem
                    key={cat.id}
                    category={cat}
                    selectedCategory={selectedCategory}
                    expandedCategories={expandedCategories}
                    onSelect={setSelectedCategory}
                    onToggleExpand={toggleExpanded}
                    onAddSubcategory={openNewCategoryDialog}
                    onEdit={handleStartEditCategory}
                    onDelete={handleDeleteCategory}
                    isStrategic={true}
                    entryCounts={entryCounts}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom categories */}
          <div>
            <h3 className="font-semibold text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Folder className="h-3 w-3" />
              WŁASNE
            </h3>
            {customCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2">
                Brak własnych kategorii
              </p>
            ) : (
              <div className="space-y-0.5">
                {customCategories.map((cat) => (
                  <CategoryItem
                    key={cat.id}
                    category={cat}
                    selectedCategory={selectedCategory}
                    expandedCategories={expandedCategories}
                    onSelect={setSelectedCategory}
                    onToggleExpand={toggleExpanded}
                    onAddSubcategory={openNewCategoryDialog}
                    onEdit={handleStartEditCategory}
                    onDelete={handleDeleteCategory}
                    isStrategic={false}
                    entryCounts={entryCounts}
                  />
                ))}
              </div>
            )}
          </div>
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
                {!searchQuery && allCategories.length > 0 && (
                  <Button onClick={() => openNewEntryDialog(selectedCategory || undefined)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj wpis
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            entries.map((entry) => {
              const isOwner = entry.userId === currentUserId
              return (
              <Card key={entry.id} className={entry.isImportant ? "border-yellow-500/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {entry.isImportant && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                    </div>
                    {isOwner && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleToggleImportant(entry)}
                        title={entry.isImportant ? "Usuń z ważnych" : "Oznacz jako ważne"}
                      >
                        {entry.isImportant ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
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
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground mb-3">
                    {entry.content}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      style={{ borderColor: entry.category.color, color: entry.category.color }}
                    >
                      {entry.category.name}
                    </Badge>
                    {entry.visibility === "TEAM" ? (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Zespół
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Prywatne
                      </Badge>
                    )}
                    {!isOwner && entry.user?.name && (
                      <span className="text-xs text-muted-foreground">
                        Autor: {entry.user.name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Zaktualizowano: {new Date(entry.updatedAt).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                </CardContent>
              </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Entry Dialog */}
      <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edytuj wpis" : "Nowy wpis"}</DialogTitle>
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

            <div className="flex items-center gap-4">
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

            <div>
              <Label>Widoczność</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={entryForm.visibility === "PRIVATE" ? "default" : "outline"}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setEntryForm({ ...entryForm, visibility: "PRIVATE" })}
                >
                  <Lock className="h-4 w-4" />
                  Tylko ja
                </Button>
                <Button
                  type="button"
                  variant={entryForm.visibility === "TEAM" ? "default" : "outline"}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setEntryForm({ ...entryForm, visibility: "TEAM" })}
                >
                  <Users className="h-4 w-4" />
                  Udostępnij zespołowi
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {entryForm.visibility === "TEAM"
                  ? "Członkowie zespołu z tą samą kategorią zobaczą ten wpis"
                  : "Tylko Ty możesz zobaczyć ten wpis"}
              </p>
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
              {editingCategory
                ? "Edytuj kategorię"
                : categoryForm.parentId
                ? "Nowa podkategoria"
                : "Nowa kategoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="np. Procedury"
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCategoryDialog(false)
                setEditingCategory(null)
              }}
            >
              Anuluj
            </Button>
            <Button
              onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
              disabled={!categoryForm.name.trim()}
            >
              {editingCategory ? "Zapisz zmiany" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
