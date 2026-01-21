"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Trash2,
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
import { formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"

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

export default function AdminReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [adminReports, setAdminReports] = useState<AdminReport[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"

  useEffect(() => {
    if (status === "loading") return
    if (!session || !isAdmin) {
      router.push("/schedule")
      return
    }
    fetchAdminReports()
  }, [session, status, isAdmin, router])

  const fetchAdminReports = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/reports")
      if (res.ok) {
        const data = await res.json()
        setAdminReports(data)
      }
    } catch (error) {
      console.error("Error fetching admin reports:", error)
    } finally {
      setIsLoading(false)
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

  const newCount = adminReports.filter(r => r.status === "NEW").length
  const inProgressCount = adminReports.filter(r => r.status === "IN_PROGRESS").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zgłoszenia użytkowników</h1>
        <p className="text-muted-foreground">
          Przeglądaj i zarządzaj zgłoszeniami błędów i pomysłami
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Badge variant="secondary" className="text-sm py-1 px-3">
          <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
          Nowe: {newCount}
        </Badge>
        <Badge variant="secondary" className="text-sm py-1 px-3">
          <Clock className="h-3.5 w-3.5 mr-1.5 text-yellow-500" />
          W trakcie: {inProgressCount}
        </Badge>
        <Badge variant="secondary" className="text-sm py-1 px-3">
          Wszystkie: {adminReports.length}
        </Badge>
      </div>

      {/* Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Zgłoszenia ({adminReports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adminReports.length === 0 ? (
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
    </div>
  )
}
