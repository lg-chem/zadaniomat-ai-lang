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
  Sparkles,
  FileText,
  List,
  Wrench,
  HelpCircle,
  CheckCircle,
  Layout,
  X,
  GripVertical,
  Clock,
  Copy,
  History,
  RotateCcw,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconPicker, DynamicIcon } from "@/components/ui/icon-picker"
import { RichEditor, RichContent } from "@/components/ui/rich-editor"
import { useWorkspaceStore } from "@/stores/workspace-store"
import useSWR from "swr"

interface KnowledgeCategory {
  id: string
  name: string
  color: string
  icon?: string | null
  description?: string | null
  linkedCategoryId?: string | null
  parentId?: string | null
  children?: KnowledgeCategory[]
  _count: {
    entries: number
  }
}

type KnowledgeEntryType = "ARTICLE" | "SOP" | "HOWTO" | "FAQ" | "CHECKLIST" | "TEMPLATE"

interface KnowledgeStep {
  id?: string
  order: number
  title: string
  description?: string | null
  estimatedTime?: number | null
  assignedRole?: string | null
}

interface KnowledgeEntry {
  id: string
  title: string
  content: string
  type: KnowledgeEntryType
  isImportant: boolean
  visibility: "PRIVATE" | "TEAM"
  tags: string[]
  currentVersion?: number
  createdAt: string
  updatedAt: string
  category: KnowledgeCategory
  userId: string
  user?: {
    id: string
    name: string | null
  }
  steps?: KnowledgeStep[]
}

interface KnowledgeEntryVersion {
  id: string
  version: number
  title: string
  content: string
  tags: string[]
  changeType: string
  createdAt: string
  changedBy?: {
    id: string
    name: string | null
  }
}

// Entry type labels and icons
const ENTRY_TYPE_CONFIG: Record<KnowledgeEntryType, { label: string; description: string }> = {
  ARTICLE: { label: "Artykuł", description: "Standardowy wpis wiedzy" },
  SOP: { label: "Procedura (SOP)", description: "Proces z krokami do wykonania" },
  HOWTO: { label: "Instrukcja", description: "Jak coś zrobić - poradnik" },
  FAQ: { label: "FAQ", description: "Pytanie i odpowiedź" },
  CHECKLIST: { label: "Checklist", description: "Lista do odhaczenia" },
  TEMPLATE: { label: "Szablon", description: "Szablon do kopiowania" },
}

// Icon component for entry types
function EntryTypeIcon({ type, className }: { type: KnowledgeEntryType; className?: string }) {
  const icons: Record<KnowledgeEntryType, React.ReactNode> = {
    ARTICLE: <FileText className={className} />,
    SOP: <List className={className} />,
    HOWTO: <Wrench className={className} />,
    FAQ: <HelpCircle className={className} />,
    CHECKLIST: <CheckCircle className={className} />,
    TEMPLATE: <Layout className={className} />,
  }
  return icons[type] || <FileText className={className} />
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

// Helper to get breadcrumb path for a category
function getBreadcrumbs(categoryId: string | null, allCategories: KnowledgeCategory[]): KnowledgeCategory[] {
  if (!categoryId) return []

  const path: KnowledgeCategory[] = []
  let currentId: string | null = categoryId

  // Build flat lookup map
  const categoryMap = new Map<string, KnowledgeCategory>()
  const addToMap = (cats: KnowledgeCategory[]) => {
    for (const cat of cats) {
      categoryMap.set(cat.id, cat)
      if (cat.children) addToMap(cat.children)
    }
  }
  addToMap(allCategories)

  // Walk up the tree
  while (currentId) {
    const cat = categoryMap.get(currentId)
    if (!cat) break
    path.unshift(cat)
    currentId = cat.parentId || null
  }

  return path
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
          <DynamicIcon
            name={category.icon}
            className="h-4 w-4 flex-shrink-0"
            style={{ color: category.color }}
          />
          <span className="font-medium text-sm truncate" title={category.description || undefined}>
            {category.name}
          </span>
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
  const [useSemanticSearch, setUseSemanticSearch] = useState(false)
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
    if (useSemanticSearch && searchQuery) params.append("semantic", "true")
    return `/api/knowledge/entries?${params}`
  }, [workspace, searchQuery, useSemanticSearch])

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
  const [showVersionsDialog, setShowVersionsDialog] = useState(false)
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null)
  const [editingCategory, setEditingCategory] = useState<KnowledgeCategory | null>(null)
  const [versionsEntry, setVersionsEntry] = useState<KnowledgeEntry | null>(null)
  const [versions, setVersions] = useState<KnowledgeEntryVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  // Forms
  const [entryForm, setEntryForm] = useState({
    title: "",
    content: "",
    categoryId: "",
    isImportant: false,
    visibility: "PRIVATE" as "PRIVATE" | "TEAM",
    type: "ARTICLE" as KnowledgeEntryType,
    tags: [] as string[],
    steps: [] as KnowledgeStep[],
  })
  const [tagInput, setTagInput] = useState("")
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    icon: "Folder",
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

  const resetEntryForm = () => {
    setEntryForm({
      title: "",
      content: "",
      categoryId: "",
      isImportant: false,
      visibility: "PRIVATE",
      type: "ARTICLE",
      tags: [],
      steps: [],
    })
    setTagInput("")
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
      type: entryForm.type,
      isImportant: entryForm.isImportant,
      visibility: entryForm.visibility,
      tags: entryForm.tags,
      steps: entryForm.steps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: category || { id: entryForm.categoryId, name: "", color: "#6366f1", _count: { entries: 0 } },
      userId: currentUserId || "",
    }

    // Close dialog immediately
    setShowEntryDialog(false)
    const formData = { ...entryForm }
    resetEntryForm()

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
      type: entryForm.type,
      isImportant: entryForm.isImportant,
      visibility: entryForm.visibility,
      tags: entryForm.tags,
      steps: entryForm.steps,
      category: category || editingEntry.category,
      updatedAt: new Date().toISOString(),
    }

    // Close dialog immediately
    setEditingEntry(null)
    setShowEntryDialog(false)
    const formData = { ...entryForm }
    resetEntryForm()

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
      type: entry.type || "ARTICLE",
      tags: entry.tags || [],
      steps: entry.steps || [],
    })
    setTagInput("")
    setShowEntryDialog(true)
  }

  const openNewEntryDialog = (categoryId?: string, type?: KnowledgeEntryType) => {
    setEditingEntry(null)
    setEntryForm({
      title: "",
      content: "",
      categoryId: categoryId || allCategories[0]?.id || "",
      isImportant: false,
      visibility: "PRIVATE",
      type: type || "ARTICLE",
      tags: [],
      steps: [],
    })
    setTagInput("")
    setShowEntryDialog(true)
  }

  // Version history handlers
  const handleShowVersions = async (entry: KnowledgeEntry) => {
    setVersionsEntry(entry)
    setVersionsLoading(true)
    setShowVersionsDialog(true)
    setVersions([])

    try {
      const res = await fetch(`/api/knowledge/entries/${entry.id}/versions`)
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions || [])
      } else {
        toast.error("Nie udało się pobrać historii wersji")
      }
    } catch (error) {
      console.error("Error fetching versions:", error)
      toast.error("Błąd podczas pobierania historii")
    } finally {
      setVersionsLoading(false)
    }
  }

  const handleRestoreVersion = async (versionId: string, versionNumber: number) => {
    if (!versionsEntry) return
    if (!confirm(`Czy na pewno chcesz przywrócić wersję ${versionNumber}? Obecna treść zostanie zapisana w historii.`)) return

    try {
      const res = await fetch(`/api/knowledge/entries/${versionsEntry.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || `Przywrócono wersję ${versionNumber}`)
        // Refresh entries
        mutateEntries()
        // Refresh versions list
        handleShowVersions(versionsEntry)
      } else {
        toast.error("Nie udało się przywrócić wersji")
      }
    } catch (error) {
      console.error("Error restoring version:", error)
      toast.error("Błąd podczas przywracania wersji")
    }
  }

  // Create new entry from template
  const createFromTemplate = (template: KnowledgeEntry) => {
    setEditingEntry(null)
    setEntryForm({
      title: `${template.title} (kopia)`,
      content: template.content,
      categoryId: template.category.id,
      isImportant: false,
      visibility: "PRIVATE",
      type: "ARTICLE", // New entry is ARTICLE, not TEMPLATE
      tags: template.tags || [],
      steps: template.steps?.map(s => ({ ...s, id: undefined })) || [],
    })
    setTagInput("")
    setShowEntryDialog(true)
    toast.info("Tworzenie wpisu z szablonu - dostosuj i zapisz")
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
          icon: categoryForm.icon,
          workspace,
          parentId: categoryForm.parentId || undefined,
        }),
      })
      if (res.ok) {
        mutateCategories()
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", description: "", color: "#6366f1", icon: "Folder", parentId: "" })
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
          icon: categoryForm.icon,
        }),
      })
      if (res.ok) {
        mutateCategories()
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", description: "", color: "#6366f1", icon: "Folder", parentId: "" })
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
      description: category.description || "",
      color: category.color,
      icon: category.icon || "Folder",
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
      icon: "Folder",
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
  const totalEntriesCount = allEntries.length
  const importantEntries = allEntries.filter((e) => e.isImportant).length

  // Flattened categories for select
  const flatCats = [
    ...flattenCategories(strategicCategories),
    ...flattenCategories(customCategories),
  ]

  // Breadcrumbs for current category
  const breadcrumbs = useMemo(() => {
    return getBreadcrumbs(selectedCategory, [...strategicCategories, ...customCategories])
  }, [selectedCategory, strategicCategories, customCategories])

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
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={useSemanticSearch ? "Wyszukiwanie AI - zadaj pytanie..." : "Szukaj w bazie wiedzy..."}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant={useSemanticSearch ? "default" : "outline"}
          size="icon"
          onClick={() => setUseSemanticSearch(!useSemanticSearch)}
          title={useSemanticSearch ? "AI Search włączony" : "Włącz AI Search (semantic)"}
          className="flex-shrink-0"
        >
          <Sparkles className={`h-4 w-4 ${useSemanticSearch ? "text-yellow-300" : ""}`} />
        </Button>
      </div>
      {useSemanticSearch && (
        <p className="text-xs text-muted-foreground -mt-2">
          AI Search używa embeddingów do znajdowania semantycznie podobnych treści
        </p>
      )}

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
          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className="hover:text-foreground transition-colors"
              >
                Wszystkie
              </button>
              {breadcrumbs.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1">
                  <ChevronRight className="h-4 w-4" />
                  <button
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`hover:text-foreground transition-colors flex items-center gap-1 ${
                      cat.id === selectedCategory ? "text-foreground font-medium" : ""
                    }`}
                  >
                    <DynamicIcon name={cat.icon} className="h-3 w-3" style={{ color: cat.color }} />
                    {cat.name}
                  </button>
                </div>
              ))}
            </div>
          )}

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
              const entryType = entry.type || "ARTICLE"
              return (
              <Card key={entry.id} className={entry.isImportant ? "border-yellow-500/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {entry.isImportant && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      <EntryTypeIcon type={entryType} className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                      {entryType !== "ARTICLE" && (
                        <Badge variant="outline" className="text-xs">
                          {ENTRY_TYPE_CONFIG[entryType].label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Use as template button for TEMPLATE type entries */}
                      {entryType === "TEMPLATE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => createFromTemplate(entry)}
                          title="Utwórz wpis z tego szablonu"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Użyj
                        </Button>
                      )}
                      {isOwner && (
                        <>
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
                            onClick={() => handleShowVersions(entry)}
                            title="Historia wersji"
                          >
                            <History className="h-4 w-4" />
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
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-3">
                    <RichContent content={entry.content} />
                  </div>

                  {/* Show steps for SOP entries */}
                  {entry.steps && entry.steps.length > 0 && (
                    <div className="mb-3 p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Kroki procedury ({entry.steps.length})
                      </p>
                      <div className="space-y-2">
                        {entry.steps.map((step, index) => (
                          <Collapsible key={step.id || index}>
                            <div className="border rounded-lg bg-background">
                              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors text-left">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-bold text-primary">{index + 1}.</span>
                                  <span className="font-medium">{step.title}</span>
                                  {step.estimatedTime && (
                                    <span className="text-xs text-muted-foreground">
                                      ~{step.estimatedTime} min
                                    </span>
                                  )}
                                  {step.assignedRole && (
                                    <Badge variant="outline" className="text-xs">
                                      {step.assignedRole}
                                    </Badge>
                                  )}
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                              </CollapsibleTrigger>
                              {step.description && (
                                <CollapsibleContent>
                                  <div className="px-3 pb-3 pt-0 border-t">
                                    <div className="pt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                                      {step.description}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-2 h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigator.clipboard.writeText(step.description || "")
                                        toast.success("Skopiowano do schowka")
                                      }}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Kopiuj instrukcję
                                    </Button>
                                  </div>
                                </CollapsibleContent>
                              )}
                            </div>
                          </Collapsible>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      style={{ borderColor: entry.category.color, color: entry.category.color }}
                    >
                      {entry.category.name}
                    </Badge>

                    {/* Tags */}
                    {entry.tags && entry.tags.length > 0 && entry.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edytuj wpis" : "Nowy wpis"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Type selector */}
            <div>
              <Label>Typ wpisu</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(Object.keys(ENTRY_TYPE_CONFIG) as KnowledgeEntryType[]).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={entryForm.type === type ? "default" : "outline"}
                    size="sm"
                    className="flex items-center gap-2 justify-start"
                    onClick={() => setEntryForm({ ...entryForm, type })}
                  >
                    <EntryTypeIcon type={type} className="h-4 w-4" />
                    {ENTRY_TYPE_CONFIG[type].label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ENTRY_TYPE_CONFIG[entryForm.type].description}
              </p>
            </div>

            <div>
              <Label>Tytuł</Label>
              <Input
                value={entryForm.title}
                onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
                placeholder="np. Procedura obsługi reklamacji"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              {/* Tags input */}
              <div>
                <Label>Tagi</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        e.preventDefault()
                        if (!entryForm.tags.includes(tagInput.trim())) {
                          setEntryForm({ ...entryForm, tags: [...entryForm.tags, tagInput.trim()] })
                        }
                        setTagInput("")
                      }
                    }}
                    placeholder="Dodaj tag (Enter)"
                  />
                </div>
                {entryForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {entryForm.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                        <button
                          onClick={() => setEntryForm({
                            ...entryForm,
                            tags: entryForm.tags.filter((t) => t !== tag),
                          })}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Treść</Label>
              <RichEditor
                content={entryForm.content}
                onChange={(html) => setEntryForm({ ...entryForm, content: html })}
                placeholder={entryForm.type === "FAQ" ? "Odpowiedź na pytanie..." : "Opisz szczegółowo..."}
              />
            </div>

            {/* Steps editor for SOP type */}
            {entryForm.type === "SOP" && (
              <div>
                <Label>Kroki procedury</Label>
                <div className="space-y-2 mt-2">
                  {entryForm.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                        <span className="font-bold">{index + 1}.</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={step.title}
                          onChange={(e) => {
                            const newSteps = [...entryForm.steps]
                            newSteps[index] = { ...newSteps[index], title: e.target.value }
                            setEntryForm({ ...entryForm, steps: newSteps })
                          }}
                          placeholder="Nazwa kroku"
                          className="font-medium"
                        />
                        <Textarea
                          value={step.description || ""}
                          onChange={(e) => {
                            const newSteps = [...entryForm.steps]
                            newSteps[index] = { ...newSteps[index], description: e.target.value }
                            setEntryForm({ ...entryForm, steps: newSteps })
                          }}
                          placeholder="Opis kroku (opcjonalnie)"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <Input
                              type="number"
                              value={step.estimatedTime || ""}
                              onChange={(e) => {
                                const newSteps = [...entryForm.steps]
                                newSteps[index] = { ...newSteps[index], estimatedTime: parseInt(e.target.value) || null }
                                setEntryForm({ ...entryForm, steps: newSteps })
                              }}
                              placeholder="min"
                              className="w-20 h-8"
                            />
                          </div>
                          <Input
                            value={step.assignedRole || ""}
                            onChange={(e) => {
                              const newSteps = [...entryForm.steps]
                              newSteps[index] = { ...newSteps[index], assignedRole: e.target.value }
                              setEntryForm({ ...entryForm, steps: newSteps })
                            }}
                            placeholder="Odpowiedzialny (np. HR)"
                            className="h-8"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEntryForm({
                            ...entryForm,
                            steps: entryForm.steps.filter((_, i) => i !== index),
                          })
                        }}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEntryForm({
                        ...entryForm,
                        steps: [
                          ...entryForm.steps,
                          { order: entryForm.steps.length, title: "", description: null, estimatedTime: null, assignedRole: null },
                        ],
                      })
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj krok
                  </Button>
                </div>
              </div>
            )}

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
              <div className="flex gap-2">
                <IconPicker
                  value={categoryForm.icon}
                  onChange={(icon) => setCategoryForm({ ...categoryForm, icon })}
                />
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="np. Procedury"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Label>Opis (opcjonalny)</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Krótki opis kategorii..."
                rows={2}
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

      {/* Version History Dialog */}
      <Dialog open={showVersionsDialog} onOpenChange={setShowVersionsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historia wersji: {versionsEntry?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            {versionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Brak zapisanych wersji</p>
                <p className="text-sm">Wersje będą zapisywane automatycznie przy każdej edycji</p>
              </div>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          v{version.version}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            version.changeType === "created"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : version.changeType === "restored"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : ""
                          }`}
                        >
                          {version.changeType === "created"
                            ? "Utworzono"
                            : version.changeType === "updated"
                            ? "Edycja"
                            : version.changeType === "restored"
                            ? "Przywrócono"
                            : version.changeType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString("pl-PL")}
                        </span>
                      </div>
                      <h4 className="font-medium">{version.title}</h4>
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        <RichContent content={version.content} />
                      </div>
                      {version.tags && version.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {version.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {version.changedBy?.name && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Autor: {version.changedBy.name}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreVersion(version.id, version.version)}
                      className="ml-4 flex-shrink-0"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Przywróć
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersionsDialog(false)}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
