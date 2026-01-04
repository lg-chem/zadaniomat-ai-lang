"use client"

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from "react"
import { Plus, Trash2, Star, Check, Brain, Save, Bug, Lightbulb, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Calendar, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useSession } from "next-auth/react"
import { formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"

interface Category {
  id: string
  name: string
  color: string
  icon?: string | null
  isStrategic: boolean
  workspaceType: string
}

interface AIKnowledgeBase {
  id?: string
  workspaceType: string
  personalInfo?: string | null
  companyInfo?: string | null
  chatInstructions?: string | null
}

interface AdminReport {
  id: string
  content: string
  type: "BUG" | "FEATURE" | "OTHER"
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED"
  adminNotes?: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    image?: string | null
  }
}

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b",
  "#10b981", "#06b6d4", "#6366f1", "#84cc16", "#f97316",
]

export default function SettingsPage() {
  const { workspace } = useWorkspaceStore()
  const { data: session } = useSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // AI Knowledge Base
  const [knowledgeBase, setKnowledgeBase] = useState<AIKnowledgeBase>({
    workspaceType: workspace,
    personalInfo: "",
    companyInfo: "",
    chatInstructions: "",
  })
  const [isSavingKnowledge, setIsSavingKnowledge] = useState(false)

  // Admin Reports
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminReports, setAdminReports] = useState<AdminReport[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)

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

  const fetchKnowledgeBase = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/knowledge?workspaceType=${workspace}`)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setKnowledgeBase({
            ...data,
            personalInfo: data.personalInfo || "",
            companyInfo: data.companyInfo || "",
            chatInstructions: data.chatInstructions || "",
          })
        }
      }
    } catch (error) {
      console.error("Error fetching knowledge base:", error)
    }
  }, [workspace])

  const fetchAdminReports = useCallback(async () => {
    setIsLoadingReports(true)
    try {
      const res = await fetch("/api/admin/reports")
      if (res.ok) {
        const data = await res.json()
        setAdminReports(data)
        setIsAdmin(true)
      } else if (res.status === 403) {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error("Error fetching admin reports:", error)
    } finally {
      setIsLoadingReports(false)
    }
  }, [])

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, status }),
      })
      if (res.ok) {
        fetchAdminReports()
      }
    } catch (error) {
      console.error("Error updating report:", error)
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zgłoszenie?")) return
    try {
      const res = await fetch(`/api/admin/reports?id=${reportId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        fetchAdminReports()
      }
    } catch (error) {
      console.error("Error deleting report:", error)
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchKnowledgeBase()
    fetchAdminReports()
  }, [fetchCategories, fetchKnowledgeBase, fetchAdminReports])

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

  const handleSaveKnowledgeBase = async () => {
    setIsSavingKnowledge(true)
    try {
      const res = await fetch("/api/ai/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceType: workspace,
          personalInfo: knowledgeBase.personalInfo || null,
          companyInfo: knowledgeBase.companyInfo || null,
          chatInstructions: knowledgeBase.chatInstructions || null,
        }),
      })
      if (res.ok) {
        await fetchKnowledgeBase()
      }
    } catch (error) {
      console.error("Error saving knowledge base:", error)
    } finally {
      setIsSavingKnowledge(false)
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
    <div className="space-y-4 md:space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Ustawienia</h1>
        <p className="text-sm md:text-base text-muted-foreground">
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

      {/* Weekly Schedule Blocks */}
      <Card className="hover:border-primary/50 transition-colors">
        <Link href="/settings/weekly-schedule">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Harmonogram tygodniowy</CardTitle>
                  <CardDescription>
                    Ustaw bloki czasowe dla każdego dnia tygodnia
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Link>
      </Card>

      {/* AI Knowledge Base */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Baza wiedzy AI</CardTitle>
              <CardDescription>
                Dostarcz kontekst dla asystenta AI w workspace: <strong>{workspace}</strong>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {workspace === "PRIVATE" && (
            <div className="space-y-2">
              <Label htmlFor="personalInfo">
                Informacje osobiste i fitness
              </Label>
              <Textarea
                id="personalInfo"
                placeholder="Np. wiek, wzrost, waga, cele fitness, preferencje treningowe, ograniczenia zdrowotne..."
                value={knowledgeBase.personalInfo || ""}
                onChange={(e) =>
                  setKnowledgeBase({ ...knowledgeBase, personalInfo: e.target.value })
                }
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Te informacje pomogą AI lepiej dostosować sugestie treningów i celów
              </p>
            </div>
          )}

          {workspace === "WORK" && (
            <div className="space-y-2">
              <Label htmlFor="companyInfo">
                Informacje o firmie i projekcie
              </Label>
              <Textarea
                id="companyInfo"
                placeholder="Np. nazwa firmy, branża, projekty, cele biznesowe, zespół..."
                value={knowledgeBase.companyInfo || ""}
                onChange={(e) =>
                  setKnowledgeBase({ ...knowledgeBase, companyInfo: e.target.value })
                }
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Te informacje pomogą AI lepiej rozumieć kontekst pracy
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="chatInstructions">
              Instrukcje dla asystenta AI
            </Label>
            <Textarea
              id="chatInstructions"
              placeholder="Np. Odpowiadaj zwięźle, używaj bullet points, mów jak mentor..."
              value={knowledgeBase.chatInstructions || ""}
              onChange={(e) =>
                setKnowledgeBase({ ...knowledgeBase, chatInstructions: e.target.value })
              }
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Określ jak AI powinien się komunikować i zachowywać
            </p>
          </div>

          <Button
            onClick={handleSaveKnowledgeBase}
            disabled={isSavingKnowledge}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSavingKnowledge ? "Zapisywanie..." : "Zapisz bazę wiedzy"}
          </Button>
        </CardContent>
      </Card>

      {/* Admin Reports Section - only visible to admins */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Zgłoszenia użytkowników</CardTitle>
                <CardDescription>
                  Błędy i propozycje ficzerów od użytkowników
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingReports ? (
              <p className="text-muted-foreground">Ładowanie...</p>
            ) : adminReports.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Brak zgłoszeń
              </p>
            ) : (
              <div className="space-y-3">
                {adminReports.map((report) => (
                  <div
                    key={report.id}
                    className={`border rounded-lg p-4 space-y-3 ${
                      report.status === "NEW"
                        ? "border-blue-200 bg-blue-50/50"
                        : report.status === "IN_PROGRESS"
                        ? "border-yellow-200 bg-yellow-50/50"
                        : report.status === "RESOLVED"
                        ? "border-green-200 bg-green-50/50"
                        : "border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {report.type === "BUG" ? (
                          <Bug className="h-4 w-4 text-red-500" />
                        ) : report.type === "FEATURE" ? (
                          <Lightbulb className="h-4 w-4 text-green-500" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-gray-500" />
                        )}
                        <Badge
                          variant="outline"
                          className={
                            report.type === "BUG"
                              ? "border-red-200 text-red-700"
                              : report.type === "FEATURE"
                              ? "border-green-200 text-green-700"
                              : "border-gray-200 text-gray-700"
                          }
                        >
                          {report.type === "BUG"
                            ? "Błąd"
                            : report.type === "FEATURE"
                            ? "Pomysł"
                            : "Inne"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(report.createdAt), {
                            addSuffix: true,
                            locale: pl,
                          })}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDeleteReport(report.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>

                    {/* Content */}
                    <p className="text-sm whitespace-pre-wrap">{report.content}</p>

                    {/* User info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Od:</span>
                      <span className="font-medium">
                        {report.user.name || report.user.email}
                      </span>
                    </div>

                    {/* Status buttons */}
                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                      <Button
                        variant={report.status === "NEW" ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleUpdateReportStatus(report.id, "NEW")}
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Nowe
                      </Button>
                      <Button
                        variant={report.status === "IN_PROGRESS" ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleUpdateReportStatus(report.id, "IN_PROGRESS")}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        W trakcie
                      </Button>
                      <Button
                        variant={report.status === "RESOLVED" ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleUpdateReportStatus(report.id, "RESOLVED")}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Rozwiązane
                      </Button>
                      <Button
                        variant={report.status === "REJECTED" ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleUpdateReportStatus(report.id, "REJECTED")}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Odrzucone
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
