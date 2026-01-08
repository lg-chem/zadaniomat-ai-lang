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

interface CategoryOrganization {
  organization: {
    id: string
    name: string
  }
}

interface Category {
  id: string
  name: string
  color: string
  organizationId?: string | null // DEPRECATED
  organizations?: CategoryOrganization[]
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
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch user's owned organizations
  const { data: orgsData } = useSWR<{ owned: Organization[] }>(
    open ? "/api/organizations" : null
  )

  const organizations = orgsData?.owned || []

  // Get currently shared org IDs from category
  const getCurrentOrgIds = (): string[] => {
    if (!category) return []
    // New format: organizations array
    if (category.organizations && category.organizations.length > 0) {
      return category.organizations.map(o => o.organization.id)
    }
    // Old format: single organizationId
    if (category.organizationId) {
      return [category.organizationId]
    }
    return []
  }

  // Reset when dialog opens/closes or category changes
  useEffect(() => {
    if (open && category) {
      setSelectedOrgIds(getCurrentOrgIds())
    }
  }, [open, category])

  const toggleOrg = (orgId: string) => {
    setSelectedOrgIds(prev =>
      prev.includes(orgId)
        ? prev.filter(id => id !== orgId)
        : [...prev, orgId]
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
          organizationIds: selectedOrgIds,
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
          organizationIds: [],
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

  const currentOrgIds = getCurrentOrgIds()
  const isShared = currentOrgIds.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Udostępnij kategorię zespołom
          </DialogTitle>
          <DialogDescription>
            Udostępnij kategorię &quot;{category?.name}&quot; wybranym zespołom.
            Możesz wybrać wiele zespołów jednocześnie.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {isShared && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Ta kategoria jest udostępniona {currentOrgIds.length} {currentOrgIds.length === 1 ? "zespołowi" : "zespołom"}.
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
              <div className="space-y-2">
                <Label>Wybierz zespoły</Label>
                <p className="text-sm text-muted-foreground">
                  Zaznacz zespoły, które mają mieć dostęp do tej kategorii
                </p>
                <div className="space-y-2 mt-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                  {organizations.map((org) => (
                    <div key={org.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-md">
                      <Checkbox
                        id={`org-${org.id}`}
                        checked={selectedOrgIds.includes(org.id)}
                        onCheckedChange={() => toggleOrg(org.id)}
                      />
                      <label
                        htmlFor={`org-${org.id}`}
                        className="flex-1 text-sm cursor-pointer"
                      >
                        <div className="font-medium">{org.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {org.members.length} członków
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {isShared && (
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
              disabled={isSubmitting || organizations.length === 0}
            >
              {isSubmitting ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
