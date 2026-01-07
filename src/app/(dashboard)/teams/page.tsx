"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Users,
  Crown,
  UserPlus,
  ChevronRight,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateTeamDialog } from "@/components/teams/create-team-dialog"
import useSWR from "swr"

interface Organization {
  id: string
  name: string
  description?: string
  createdAt: string
  owner: {
    id: string
    name: string
    email: string
  }
  _count: {
    members: number
    tasks: number
  }
}

interface OrganizationsResponse {
  owned: Organization[]
  memberOf: Organization[]
}

export default function TeamsPage() {
  const router = useRouter()
  const [showCreateTeam, setShowCreateTeam] = useState(false)

  const { data, isLoading, mutate } = useSWR<OrganizationsResponse>(
    "/api/organizations"
  )

  const owned = data?.owned || []
  const memberOf = data?.memberOf || []

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const hasTeams = owned.length > 0 || memberOf.length > 0

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Zespoły</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Zarządzaj zespołami i przydzielaj zadania pracownikom
          </p>
        </div>
        <Button onClick={() => setShowCreateTeam(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nowy zespół
        </Button>
      </div>

      {!hasTeams ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak zespołów</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Stwórz zespół, aby móc dodawać pracowników i przydzielać im zadania
            </p>
            <Button onClick={() => setShowCreateTeam(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Stwórz zespół
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Owned teams */}
          {owned.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Moje zespoły
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {owned.map((org) => (
                  <Card
                    key={org.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/teams/${org.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{org.name}</CardTitle>
                          {org.description && (
                            <CardDescription className="line-clamp-2 mt-1">
                              {org.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant="secondary">
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {org._count.members} członków
                          </span>
                          <span>{org._count.tasks} zadań</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Member of teams */}
          {memberOf.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-500" />
                Zespoły, do których należę
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {memberOf.map((org) => (
                  <Card
                    key={org.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/teams/${org.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{org.name}</CardTitle>
                          {org.description && (
                            <CardDescription className="line-clamp-2 mt-1">
                              {org.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant="outline">Członek</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>Admin: {org.owner.name || org.owner.email}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Team Dialog */}
      <CreateTeamDialog
        open={showCreateTeam}
        onOpenChange={setShowCreateTeam}
        onSuccess={mutate}
      />
    </div>
  )
}
