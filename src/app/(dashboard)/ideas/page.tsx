"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import {
  Plus,
  Lightbulb,
  Pencil,
  Trash2,
  FolderPlus,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import useSWR from "swr"

interface Organization {
  id: string
  name: string
  role: string
}

interface IdeaCategory {
  id: string
  name: string
  color: string
  emoji?: string | null
  _count: { ideas: number }
}

interface Idea {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  userId: string
  category: IdeaCategory
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

export default function IdeasPage() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  // Fetch user's organizations
  const { data: organizations = [] } = useSWR<Organization[]>("/api/organizations")
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  // Set first org as default when loaded
  if (organizations.length > 0 && !selectedOrgId) {
    setSelectedOrgId(organizations[0].id)
  }

  // Fetch categories for selected org
  const { data: categories = [], mutate: mutateCategories } = useSWR<IdeaCategory[]>(
    selectedOrgId ? `/api/ideas/categories?organizationId=${selectedOrgId}` : null
  )

  // Fetch ideas
  const ideasUrl = selectedOrgId
    ? `/api/ideas?organizationId=${selectedOrgId}${selectedCategoryId ? `&categoryId=${selectedCategoryId}` : ""}`
    : null
  const { data: ideas = [], isLoading, mutate: mutateIdeas } = useSWR<Idea[]>(ideasUrl)

  // Dialogs
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<IdeaCategory | null>(null)

  // Forms
  const [newIdea, setNewIdea] = useState("")
  const [newIdeaCategoryId, setNewIdeaCategoryId] = useState("")
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    color: "#8b5cf6",
    emoji: "",
  })

  // Check if user is admin
  const currentOrgRole = organizations.find(o => o.id === selectedOrgId)?.role
  const isAdmin = currentOrgRole === "OWNER" || currentOrgRole === "ADMIN"

  const handleCreateIdea = async () => {
    if (!newIdea.trim() || !newIdeaCategoryId) return

    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newIdea,
          categoryId: newIdeaCategoryId,
        }),
      })
      if (res.ok) {
        mutateIdeas()
        mutateCategories()
        setNewIdea("")
      }
    } catch (error) {
      console.error("Error creating idea:", error)
    }
  }

  const handleDeleteIdea = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę rozkminkę?")) return

    try {
      await fetch(`/api/ideas/${id}`, { method: "DELETE" })
      mutateIdeas()
      mutateCategories()
    } catch (error) {
      console.error("Error deleting idea:", error)
    }
  }

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim() || !selectedOrgId) return

    try {
      const res = await fetch("/api/ideas/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name,
          color: categoryForm.color,
          emoji: categoryForm.emoji || null,
          organizationId: selectedOrgId,
        }),
      })
      if (res.ok) {
        mutateCategories()
        setShowCategoryDialog(false)
        setCategoryForm({ name: "", color: "#8b5cf6", emoji: "" })
      }
    } catch (error) {
      console.error("Error creating category:", error)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę kategorię i wszystkie jej rozkminki?")) return

    try {
      await fetch(`/api/ideas/categories/${id}`, { method: "DELETE" })
      mutateCategories()
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null)
      }
      mutateIdeas()
    } catch (error) {
      console.error("Error deleting category:", error)
    }
  }

  const totalIdeas = categories.reduce((sum, cat) => sum + cat._count.ideas, 0)

  if (organizations.length === 0) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-7 w-7" />
            Rozkminki
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Dziel się pomysłami z zespołem
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak zespołów</h3>
            <p className="text-muted-foreground text-center">
              Dołącz do zespołu, aby dzielić się rozkminkami
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-1">
            <CardContent className="space-y-2 pt-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
          <div className="lg:col-span-3 grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
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
            <Lightbulb className="h-7 w-7" />
            Rozkminki
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Dziel się pomysłami z zespołem
          </p>
        </div>
        <div className="flex gap-2">
          {organizations.length > 1 && (
            <Select value={selectedOrgId || ""} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Wybierz zespół" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowCategoryDialog(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Nowa kategoria
            </Button>
          )}
        </div>
      </div>

      {/* Quick add */}
      {categories.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Select value={newIdeaCategoryId} onValueChange={setNewIdeaCategoryId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Kategoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        {cat.emoji && <span>{cat.emoji}</span>}
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Napisz swoją rozkminkę..."
                value={newIdea}
                onChange={(e) => setNewIdea(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateIdea()}
                className="flex-1"
              />
              <Button onClick={handleCreateIdea} disabled={!newIdea.trim() || !newIdeaCategoryId}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Categories sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {/* All */}
          <div
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
              selectedCategoryId === null ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
            }`}
            onClick={() => setSelectedCategoryId(null)}
          >
            <span className="font-medium text-sm">Wszystkie</span>
            <Badge variant="secondary" className="text-xs">
              {totalIdeas}
            </Badge>
          </div>

          {/* Categories */}
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group ${
                selectedCategoryId === cat.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
              }`}
              onClick={() => setSelectedCategoryId(cat.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {cat.emoji && <span>{cat.emoji}</span>}
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="font-medium text-sm truncate">{cat.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">
                  {cat._count.ideas}
                </Badge>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteCategory(cat.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {categories.length === 0 && isAdmin && (
            <p className="text-xs text-muted-foreground p-2">
              Stwórz pierwszą kategorię, aby dodawać rozkminki
            </p>
          )}
        </div>

        {/* Ideas grid */}
        <div className="lg:col-span-3">
          {ideas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Brak rozkmin</h3>
                <p className="text-muted-foreground text-center">
                  {categories.length === 0
                    ? "Najpierw stwórz kategorię"
                    : "Dodaj pierwszą rozkminkę"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ideas.map((idea) => {
                const isOwner = idea.userId === currentUserId
                return (
                  <Card key={idea.id} className="group">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={idea.user.image || undefined} />
                            <AvatarFallback className="text-xs">
                              {idea.user.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{idea.user.name}</span>
                        </div>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => handleDeleteIdea(idea.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap mb-3">{idea.content}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: idea.category.color, color: idea.category.color }}
                        >
                          {idea.category.emoji && <span className="mr-1">{idea.category.emoji}</span>}
                          {idea.category.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(idea.createdAt).toLocaleDateString("pl-PL")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowa kategoria rozkmin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="np. Pomysły na produkt"
              />
            </div>

            <div>
              <Label>Emoji (opcjonalnie)</Label>
              <Input
                value={categoryForm.emoji}
                onChange={(e) => setCategoryForm({ ...categoryForm, emoji: e.target.value })}
                placeholder="np. 💡"
                maxLength={2}
              />
            </div>

            <div>
              <Label>Kolor</Label>
              <div className="flex gap-2 mt-2">
                {["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#06b6d4", "#84cc16"].map(
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
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={handleCreateCategory} disabled={!categoryForm.name.trim()}>
              Utwórz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
