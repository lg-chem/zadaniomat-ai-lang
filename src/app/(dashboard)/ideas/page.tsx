"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import {
  Lightbulb,
  Trash2,
  FolderPlus,
  Send,
  MessageSquare,
  ArrowLeft,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

interface OrganizationsResponse {
  owned: Array<{ id: string; name: string }>
  memberOf: Array<{ id: string; name: string; members: Array<{ role: string }> }>
}

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
  linkedCategory?: {
    id: string
    name: string
    icon?: string | null
  } | null
  _count: { ideas: number }
}

interface Idea {
  id: string
  title?: string | null
  content: string
  createdAt: string
  updatedAt: string
  userId: string
  category: {
    id: string
    name: string
    color: string
    emoji?: string | null
    linkedCategory?: {
      icon?: string | null
    } | null
  }
  user: {
    id: string
    name: string | null
    image: string | null
  }
  _count: {
    replies: number
  }
}

interface IdeaReply {
  id: string
  content: string
  createdAt: string
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
  const { data: orgsData } = useSWR<OrganizationsResponse>("/api/organizations")

  // Transform organizations response to flat array with roles
  const organizations: Organization[] = orgsData
    ? [
        ...orgsData.owned.map((org) => ({ ...org, role: "OWNER" as const })),
        ...orgsData.memberOf.map((org) => ({
          id: org.id,
          name: org.name,
          role: org.members?.[0]?.role || "MEMBER",
        })),
      ]
    : []

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)

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

  // Fetch replies for selected idea
  const { data: replies = [], mutate: mutateReplies } = useSWR<IdeaReply[]>(
    selectedIdea ? `/api/ideas/${selectedIdea.id}/replies` : null
  )

  // Dialogs
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showNewIdeaDialog, setShowNewIdeaDialog] = useState(false)
  const [showEditIdeaDialog, setShowEditIdeaDialog] = useState(false)

  // Forms
  const [newIdeaForm, setNewIdeaForm] = useState({
    title: "",
    content: "",
    categoryId: "",
  })
  const [editIdeaForm, setEditIdeaForm] = useState({
    title: "",
    content: "",
  })
  const [replyContent, setReplyContent] = useState("")
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    color: "#8b5cf6",
    emoji: "",
  })

  // Check if user is owner (can manage categories)
  const currentOrgRole = organizations.find(o => o.id === selectedOrgId)?.role
  const isAdmin = currentOrgRole === "OWNER"

  const handleCreateIdea = async () => {
    if (!newIdeaForm.content.trim() || !newIdeaForm.categoryId) return

    const category = categories.find(c => c.id === newIdeaForm.categoryId)
    const tempId = `temp-${Date.now()}`
    const optimisticIdea: Idea = {
      id: tempId,
      title: newIdeaForm.title || null,
      content: newIdeaForm.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: currentUserId || "",
      category: category ? {
        id: category.id,
        name: category.name,
        color: category.color,
        emoji: category.emoji,
        linkedCategory: category.linkedCategory,
      } : { id: newIdeaForm.categoryId, name: "", color: "#8b5cf6" },
      user: {
        id: currentUserId || "",
        name: session?.user?.name || null,
        image: session?.user?.image || null,
      },
      _count: { replies: 0 },
    }

    // Close dialog immediately
    setShowNewIdeaDialog(false)
    const formData = { ...newIdeaForm }
    setNewIdeaForm({ title: "", content: "", categoryId: "" })

    // Optimistic update
    mutateIdeas(
      async (currentIdeas) => {
        const res = await fetch("/api/ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title || null,
            content: formData.content,
            categoryId: formData.categoryId,
          }),
        })
        if (!res.ok) throw new Error("Failed to create idea")
        const newIdea = await res.json()
        toast.success("Rozkminka dodana")
        return [newIdea, ...(currentIdeas || []).filter(i => i.id !== tempId)]
      },
      {
        optimisticData: (currentIdeas) => [optimisticIdea, ...(currentIdeas || [])],
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się dodać rozkminki")
    })

    mutateCategories()
  }

  const handleDeleteIdea = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm("Czy na pewno chcesz usunąć tę rozkminkę?")) return

    if (selectedIdea?.id === id) {
      setSelectedIdea(null)
    }

    // Optimistic delete
    mutateIdeas(
      async (currentIdeas) => {
        const res = await fetch(`/api/ideas/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete idea")
        toast.success("Rozkminka usunięta")
        return (currentIdeas || []).filter(i => i.id !== id)
      },
      {
        optimisticData: (currentIdeas) => (currentIdeas || []).filter(i => i.id !== id),
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się usunąć rozkminki")
    })

    mutateCategories()
  }

  const handleCreateReply = async () => {
    if (!replyContent.trim() || !selectedIdea) return

    const tempId = `temp-${Date.now()}`
    const optimisticReply: IdeaReply = {
      id: tempId,
      content: replyContent,
      createdAt: new Date().toISOString(),
      user: {
        id: currentUserId || "",
        name: session?.user?.name || null,
        image: session?.user?.image || null,
      },
    }

    const content = replyContent
    setReplyContent("")

    // Optimistic update
    mutateReplies(
      async (currentReplies) => {
        const res = await fetch(`/api/ideas/${selectedIdea.id}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })
        if (!res.ok) throw new Error("Failed to create reply")
        const newReply = await res.json()
        toast.success("Odpowiedź dodana")
        return [...(currentReplies || []).filter(r => r.id !== tempId), newReply]
      },
      {
        optimisticData: (currentReplies) => [...(currentReplies || []), optimisticReply],
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się dodać odpowiedzi")
      setReplyContent(content)
    })

    mutateIdeas()
  }

  const handleEditIdea = async () => {
    if (!editIdeaForm.content.trim() || !selectedIdea) return

    const ideaId = selectedIdea.id
    const updatedIdea: Idea = {
      ...selectedIdea,
      title: editIdeaForm.title || null,
      content: editIdeaForm.content,
      updatedAt: new Date().toISOString(),
    }

    // Update selected immediately
    setSelectedIdea(updatedIdea)
    setShowEditIdeaDialog(false)
    const formData = { ...editIdeaForm }

    // Optimistic update
    mutateIdeas(
      async (currentIdeas) => {
        const res = await fetch(`/api/ideas/${ideaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title || null,
            content: formData.content,
          }),
        })
        if (!res.ok) throw new Error("Failed to update idea")
        const serverIdea = await res.json()
        setSelectedIdea(serverIdea)
        toast.success("Rozkminka zaktualizowana")
        return (currentIdeas || []).map(i => i.id === ideaId ? serverIdea : i)
      },
      {
        optimisticData: (currentIdeas) => (currentIdeas || []).map(i => i.id === ideaId ? updatedIdea : i),
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się zaktualizować rozkminki")
    })
  }

  const openEditDialog = () => {
    if (selectedIdea) {
      setEditIdeaForm({
        title: selectedIdea.title || "",
        content: selectedIdea.content,
      })
      setShowEditIdeaDialog(true)
    }
  }

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim() || !selectedOrgId) return

    const tempId = `temp-${Date.now()}`
    const optimisticCategory: IdeaCategory = {
      id: tempId,
      name: categoryForm.name,
      color: categoryForm.color,
      emoji: categoryForm.emoji || null,
      _count: { ideas: 0 },
    }

    // Close dialog immediately
    setShowCategoryDialog(false)
    const formData = { ...categoryForm }
    setCategoryForm({ name: "", color: "#8b5cf6", emoji: "" })

    // Optimistic update
    mutateCategories(
      async (currentCategories) => {
        const res = await fetch("/api/ideas/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            color: formData.color,
            emoji: formData.emoji || null,
            organizationId: selectedOrgId,
          }),
        })
        if (!res.ok) throw new Error("Failed to create category")
        const newCategory = await res.json()
        toast.success("Kategoria utworzona")
        return [...(currentCategories || []).filter(c => c.id !== tempId), newCategory]
      },
      {
        optimisticData: (currentCategories) => [...(currentCategories || []), optimisticCategory],
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się utworzyć kategorii")
    })
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę kategorię i wszystkie jej rozkminki?")) return

    if (selectedCategoryId === id) {
      setSelectedCategoryId(null)
    }

    // Optimistic delete
    mutateCategories(
      async (currentCategories) => {
        const res = await fetch(`/api/ideas/categories/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete category")
        toast.success("Kategoria usunięta")
        return (currentCategories || []).filter(c => c.id !== id)
      },
      {
        optimisticData: (currentCategories) => (currentCategories || []).filter(c => c.id !== id),
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error("Nie udało się usunąć kategorii")
    })

    mutateIdeas()
  }

  const totalIdeas = categories.reduce((sum, cat) => sum + cat._count.ideas, 0)

  // Detail view when idea is selected
  if (selectedIdea) {
    const icon = selectedIdea.category.emoji || selectedIdea.category.linkedCategory?.icon
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedIdea(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              {selectedIdea.title || "Rozkminka"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                style={{ borderColor: selectedIdea.category.color, color: selectedIdea.category.color }}
              >
                {icon && <span className="mr-1">{icon}</span>}
                {selectedIdea.category.name}
              </Badge>
            </div>
          </div>
        </div>

        {/* Main idea */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedIdea.user.image || undefined} />
                <AvatarFallback>{selectedIdea.user.name?.charAt(0) || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{selectedIdea.user.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(selectedIdea.createdAt).toLocaleDateString("pl-PL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {selectedIdea.userId === currentUserId && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={openEditDialog}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDeleteIdea(selectedIdea.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap">{selectedIdea.content}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Replies */}
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Odpowiedzi ({replies.length})
          </h2>

          {replies.map((reply) => (
            <Card key={reply.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={reply.user.image || undefined} />
                    <AvatarFallback className="text-xs">{reply.user.name?.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{reply.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(reply.createdAt).toLocaleDateString("pl-PL", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{reply.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Reply form */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Napisz odpowiedź..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="flex-1 min-h-[80px]"
                />
              </div>
              <div className="flex justify-end mt-2">
                <Button onClick={handleCreateReply} disabled={!replyContent.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Odpowiedz
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

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
          <div className="lg:col-span-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
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
          {categories.map((cat) => {
            const icon = cat.emoji || cat.linkedCategory?.icon
            const isLinked = !!cat.linkedCategory
            return (
              <div
                key={cat.id}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group ${
                  selectedCategoryId === cat.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                }`}
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {icon && <span>{icon}</span>}
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="font-medium text-sm truncate">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {cat._count.ideas}
                  </Badge>
                  {isAdmin && !isLinked && (
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
            )
          })}

          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">
              {isAdmin
                ? "Stwórz kategorie strategiczne w zespole, aby dodawać rozkminki"
                : "Brak kategorii - poczekaj aż admin doda kategorie strategiczne"}
            </p>
          )}

          {/* New idea button */}
          {categories.length > 0 && (
            <Button
              className="w-full mt-4"
              onClick={() => {
                setNewIdeaForm({ ...newIdeaForm, categoryId: selectedCategoryId || categories[0]?.id || "" })
                setShowNewIdeaDialog(true)
              }}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Nowa rozkminka
            </Button>
          )}
        </div>

        {/* Ideas list (forum style) */}
        <div className="lg:col-span-3 space-y-3">
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
            ideas.map((idea) => {
              const isOwner = idea.userId === currentUserId
              const icon = idea.category.emoji || idea.category.linkedCategory?.icon
              return (
                <Card
                  key={idea.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedIdea(idea)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={idea.user.image || undefined} />
                        <AvatarFallback>{idea.user.name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {idea.title && (
                              <h3 className="font-semibold truncate">{idea.title}</h3>
                            )}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{idea.user.name}</span>
                              <span>•</span>
                              <span>{new Date(idea.createdAt).toLocaleDateString("pl-PL")}</span>
                            </div>
                          </div>
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={(e) => handleDeleteIdea(idea.id, e)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-sm line-clamp-2">{idea.content}</p>
                        <div className="flex items-center gap-3 mt-3">
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: idea.category.color, color: idea.category.color }}
                          >
                            {icon && <span className="mr-1">{icon}</span>}
                            {idea.category.name}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            {idea._count.replies}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* New Idea Dialog */}
      <Dialog open={showNewIdeaDialog} onOpenChange={setShowNewIdeaDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nowa rozkminka</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Kategoria</Label>
              <Select
                value={newIdeaForm.categoryId}
                onValueChange={(val) => setNewIdeaForm({ ...newIdeaForm, categoryId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => {
                    const icon = cat.emoji || cat.linkedCategory?.icon
                    return (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          {icon && <span>{icon}</span>}
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tytuł (opcjonalnie)</Label>
              <Input
                value={newIdeaForm.title}
                onChange={(e) => setNewIdeaForm({ ...newIdeaForm, title: e.target.value })}
                placeholder="np. Pomysł na nową funkcję"
              />
            </div>

            <div>
              <Label>Treść</Label>
              <Textarea
                value={newIdeaForm.content}
                onChange={(e) => setNewIdeaForm({ ...newIdeaForm, content: e.target.value })}
                placeholder="Opisz swoją rozkminkę..."
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewIdeaDialog(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleCreateIdea}
              disabled={!newIdeaForm.content.trim() || !newIdeaForm.categoryId}
            >
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Edit Idea Dialog */}
      <Dialog open={showEditIdeaDialog} onOpenChange={setShowEditIdeaDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edytuj rozkminkę</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Tytuł (opcjonalnie)</Label>
              <Input
                value={editIdeaForm.title}
                onChange={(e) => setEditIdeaForm({ ...editIdeaForm, title: e.target.value })}
                placeholder="np. Pomysł na nową funkcję"
              />
            </div>

            <div>
              <Label>Treść</Label>
              <Textarea
                value={editIdeaForm.content}
                onChange={(e) => setEditIdeaForm({ ...editIdeaForm, content: e.target.value })}
                placeholder="Opisz swoją rozkminkę..."
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditIdeaDialog(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleEditIdea}
              disabled={!editIdeaForm.content.trim()}
            >
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
