"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Users,
  Check,
  X,
  Trash2,
  Shield,
  ShieldCheck,
  User as UserIcon,
  Loader2,
  Bug,
  Lightbulb,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"

interface User {
  id: string
  email: string
  name: string | null
  role: string
  isApproved: boolean
  createdAt: string
  image: string | null
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

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

  // Admin Reports
  const [adminReports, setAdminReports] = useState<AdminReport[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(true)

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  useEffect(() => {
    if (status === "loading") return
    if (!session || !isAdmin) {
      router.push("/dashboard")
      return
    }
    fetchUsers()
    fetchAdminReports()
  }, [session, status, isAdmin, router])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAdminReports = async () => {
    setIsLoadingReports(true)
    try {
      const res = await fetch("/api/admin/reports")
      if (res.ok) {
        const data = await res.json()
        setAdminReports(data)
      }
    } catch (error) {
      console.error("Error fetching admin reports:", error)
    } finally {
      setIsLoadingReports(false)
    }
  }

  const handleUpdateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, status: newStatus }),
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

  const toggleApproval = async (userId: string, isApproved: boolean) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: !isApproved }),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(users.map((u) => (u.id === userId ? data.user : u)))
      }
    } catch (error) {
      console.error("Error toggling approval:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const changeRole = async (userId: string, role: string) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(users.map((u) => (u.id === userId ? data.user : u)))
      }
    } catch (error) {
      console.error("Error changing role:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const deleteUser = async (userId: string) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== userId))
      }
    } catch (error) {
      console.error("Error deleting user:", error)
    } finally {
      setActionLoading(null)
      setDeleteUserId(null)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return (
          <Badge variant="destructive" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            Super Admin
          </Badge>
        )
      case "ADMIN":
        return (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <UserIcon className="h-3 w-3" />
            Użytkownik
          </Badge>
        )
    }
  }

  const pendingUsers = users.filter((u) => !u.isApproved)
  const approvedUsers = users.filter((u) => u.isApproved)

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zarządzanie użytkownikami</h1>
        <p className="text-muted-foreground">
          Zarządzaj użytkownikami i ich uprawnieniami
        </p>
      </div>

      {/* Pending Approval Section */}
      {pendingUsers.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Users className="h-5 w-5" />
              Oczekujące na zatwierdzenie ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-background rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.image || ""} />
                      <AvatarFallback>
                        {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name || "Brak nazwy"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(user.createdAt), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => toggleApproval(user.id, user.isApproved)}
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        <span className="ml-1">Zatwierdź</span>
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteUserId(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approved Users Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Aktywni użytkownicy ({approvedUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Brak aktywnych użytkowników
            </p>
          ) : (
            <div className="space-y-3">
              {approvedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.image || ""} />
                      <AvatarFallback>
                        {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.name || "Brak nazwy"}</p>
                        {getRoleBadge(user.role)}
                        {user.id === session?.user?.id && (
                          <Badge variant="outline" className="text-xs">Ty</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(user.createdAt), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </span>
                    {user.id !== session?.user?.id && (
                      <div className="flex gap-2">
                        {isSuperAdmin && (
                          <Select
                            value={user.role}
                            onValueChange={(value) => changeRole(user.id, value)}
                            disabled={actionLoading === user.id}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USER">Użytkownik</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleApproval(user.id, user.isApproved)}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="ml-1">Cofnij dostęp</span>
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteUserId(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Zgłoszenia użytkowników ({adminReports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingReports ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
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
                      ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
                      : report.status === "IN_PROGRESS"
                      ? "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20"
                      : report.status === "RESOLVED"
                      ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                      : "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/20"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
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
                            ? "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400"
                            : report.type === "FEATURE"
                            ? "border-green-200 text-green-700 dark:border-green-800 dark:text-green-400"
                            : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-400"
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
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={report.user.image || ""} />
                      <AvatarFallback className="text-[10px]">
                        {report.user.name?.charAt(0) || report.user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć tego użytkownika?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja jest nieodwracalna. Wszystkie dane użytkownika zostaną trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUser(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
