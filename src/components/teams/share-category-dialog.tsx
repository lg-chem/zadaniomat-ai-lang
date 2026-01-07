"use client"

import { useState, useEffect } from "react"
import { Share2, Users, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import useSWR from "swr"

interface Organization {
  id: string
  name: string
  members: {
    id: string
    userId: string
    user: {
      id: string
      name: string
      email: string
    }
  }[]
}

interface Category {
  id: string
  name: string
  color: string
  organizationId?: string | null
}

interface ShareCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  onSuccess: () => void
}

export function ShareCategoryDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: ShareCategoryDialogProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("")
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch user's owned organizations
  const { data: orgsData } = useSWR<{ owned: Organization[] }>(
    open ? "/api/organizations" : null
  )

  const organizations = orgsData?.owned || []
  const selectedOrg = organizations.find(o => o.id === selectedOrgId)

  // Reset when dialog opens/closes or category changes
  useEffect(() => {
    if (open && category) {
      setSelectedOrgId(category.organizationId || "")
      setSelectedMemberIds([])
    }
  }, [open, category])

  // When org changes, select all members by default
  useEffect(() => {
    if (selectedOrg) {
      setSelectedMemberIds(selectedOrg.members.map(m => m.user.id))
    } else {
      setSelectedMemberIds([])
    }
  }, [selectedOrg])

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrgId || null,
          memberIds: selectedOrgId ? selectedMemberIds : [],
        }),
      })

      if (res.ok) {
        onOpenChange(false)
        onSuccess()
      }
    } catch (error) {
      console.error("Error sharing category:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnshare = async () => {
    if (!category) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: null,
        }),
      })

      if (res.ok) {
        onOpenChange(false)
        onSuccess()
      }
    } catch (error) {
      console.error("Error unsharing category:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Udostępnij kategorię zespołowi
          </DialogTitle>
          <DialogDescription>
            Udostępnij kategorię &quot;{category?.name}&quot; członkom zespołu
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {category?.organizationId && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Ta kategoria jest już udostępniona zespołowi.
                  Możesz zmienić ustawienia lub cofnąć udostępnianie.
                </AlertDescription>
              </Alert>
            )}

            {organizations.length === 0 ? (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  Nie masz żadnych zespołów. Najpierw utwórz zespół w zakładce &quot;Zespoły&quot;.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Wybierz zespół</Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz zespół..." />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name} ({org.members.length} członków)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedOrg && selectedOrg.members.length > 0 && (
                  <div className="space-y-2">
                    <Label>Członkowie z dostępem</Label>
                    <p className="text-sm text-muted-foreground">
                      Wybierz, którzy członkowie będą widzieć tę kategorię
                    </p>
                    <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                      {selectedOrg.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2">
                          <Checkbox
                            id={member.id}
                            checked={selectedMemberIds.includes(member.user.id)}
                            onCheckedChange={() => toggleMember(member.user.id)}
                          />
                          <label
                            htmlFor={member.id}
                            className="text-sm cursor-pointer"
                          >
                            {member.user.name || member.user.email}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            {category?.organizationId && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleUnshare}
                disabled={isSubmitting}
              >
                Cofnij udostępnianie
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedOrgId || organizations.length === 0}
            >
              {isSubmitting ? "Zapisywanie..." : "Udostępnij"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
