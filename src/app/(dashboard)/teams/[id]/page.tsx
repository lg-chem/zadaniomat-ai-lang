"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  Crown,
  Users,
  Trash2,
  UserMinus,
  FolderOpen,
  ClipboardList,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AddMemberDialog } from "@/components/teams/add-member-dialog"
import { CreateTeamCategoryDialog } from "@/components/teams/create-team-category-dialog"
import { AssignTaskDialog } from "@/components/teams/assign-task-dialog"
import { ShareExistingCategoryDialog } from "@/components/teams/share-existing-category-dialog"
import useSWR from "swr"

interface Member {
  id: string
  role: "OWNER" | "MEMBER"
  joinedAt: string
  user: {
    id: string
    name: string
    email: string
    image?: string
  }
  assignedCategories: {
    category: {
      id: string
      name: string
      color: string
    }
  }[]
}

interface Category {
  id: string
  name: string
  color: string
  _count: { tasks: number }
}

interface Organization {
  id: string
  name: string
  description?: string
  isOwner: boolean
  owner: {
    id: string
    name: string
    email: string
  }
  members: Member[]
  categories: Category[]
  _count: {
    members: number
    tasks: number
  }
}

export default function TeamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string

  const [showAddMember, setShowAddMember] = useState(false)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [showShareExisting, setShowShareExisting] = useState(false)
  const [showAssignTask, setShowAssignTask] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const { data: team, isLoading, mutate } = useSWR<Organization>(
    teamId ? `/api/organizations/${teamId}` : null
  )

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tego członka z zespołu?")) return

    try {
      const res = await fetch(`/api/organizations/${teamId}/members/${memberId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        mutate()
      }
    } catch (error) {
      console.error("Error removing member:", error)
    }
  }

  const handleDeleteTeam = async () => {
    if (!confirm("Czy na pewno chcesz usunąć ten zespół? Ta operacja jest nieodwracalna.")) return

    try {
      const res = await fetch(`/api/organizations/${teamId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        router.push("/teams")
      }
    } catch (error) {
      console.error("Error deleting team:", error)
    }
  }

  const openAssignTask = (memberId: string) => {
    setSelectedMemberId(memberId)
    setShowAssignTask(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold mb-2">Zespół nie znaleziony</h2>
        <Button onClick={() => router.push("/teams")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Powrót do zespołów
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/teams")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              {team.name}
              {team.isOwner && (
                <Badge variant="secondary">
                  <Crown className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
            </h1>
            {team.description && (
              <p className="text-muted-foreground mt-1">{team.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {team._count.members} członków
              </span>
              <span>{team._count.tasks} zadań</span>
            </div>
          </div>
        </div>

        {team.isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDeleteTeam}>
              <Trash2 className="h-4 w-4 mr-2" />
              Usuń zespół
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Członkowie
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Kategorie
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Członkowie zespołu</CardTitle>
                <CardDescription>
                  Zarządzaj członkami i przydzielaj im zadania
                </CardDescription>
              </div>
              {team.isOwner && (
                <Button onClick={() => setShowAddMember(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj członka
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.user.image} />
                        <AvatarFallback>
                          {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {member.user.name || member.user.email}
                          </span>
                          {member.role === "OWNER" && (
                            <Badge variant="secondary" className="text-xs">
                              <Crown className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.user.email}
                        </div>
                        {member.assignedCategories.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {member.assignedCategories.map(({ category }) => (
                              <Badge
                                key={category.id}
                                variant="outline"
                                style={{ borderColor: category.color, color: category.color }}
                                className="text-xs"
                              >
                                {category.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignTask(member.user.id)}
                      >
                        <ClipboardList className="h-4 w-4 mr-1" />
                        Przydziel zadanie
                      </Button>
                      {team.isOwner && member.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Kategorie zespołowe</CardTitle>
                <CardDescription>
                  Kategorie wspólne dla całego zespołu
                </CardDescription>
              </div>
              {team.isOwner && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowShareExisting(true)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Dodaj istniejącą
                  </Button>
                  <Button onClick={() => setShowCreateCategory(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nowa kategoria
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {team.categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Brak kategorii zespołowych</p>
                  {team.isOwner && (
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => setShowCreateCategory(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj kategorię
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {team.categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{ borderLeftColor: category.color, borderLeftWidth: 4 }}
                    >
                      <div>
                        <div className="font-medium">{category.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {category._count.tasks} zadań
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        organizationId={teamId}
        categories={team.categories}
        onSuccess={mutate}
      />

      <CreateTeamCategoryDialog
        open={showCreateCategory}
        onOpenChange={setShowCreateCategory}
        organizationId={teamId}
        onSuccess={mutate}
      />

      <ShareExistingCategoryDialog
        open={showShareExisting}
        onOpenChange={setShowShareExisting}
        organizationId={teamId}
        members={team.members}
        existingCategoryIds={team.categories.map(c => c.id)}
        onSuccess={mutate}
      />

      <AssignTaskDialog
        open={showAssignTask}
        onOpenChange={setShowAssignTask}
        organizationId={teamId}
        assignedToId={selectedMemberId}
        categories={team.categories}
        onSuccess={mutate}
      />
    </div>
  )
}
