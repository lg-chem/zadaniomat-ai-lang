"use client"

import { useState, useEffect } from "react"
import { FolderPlus } from "lucide-react"
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
  organizationId?: string | null // Legacy
  organizations?: CategoryOrganization[]
  isOwner?: boolean
}

interface Member {
  id: string
  user: {
    id: string
    name: string
    email: string
  }
}

interface ShareExistingCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  members: Member[]
  existingCategoryIds: string[] // Categories already shared with this team
  onSuccess: () => void
}

export function ShareExistingCategoryDialog({
  open,
  onOpenChange,
  organizationId,
  members,
  existingCategoryIds,
  onSuccess,
}: ShareExistingCategoryDialogProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch user's own categories
  const { data: categoriesData } = useSWR<Category[]>(
    open ? "/api/categories" : null
  )

  // Filter: only show user's own categories that are NOT already shared with THIS team
  // With many-to-many, a category CAN be shared with multiple teams
  const availableCategories = (categoriesData || []).filter((c) => {
    // Must be user's own category
    if (!c.isOwner) return false
    // Check if already shared with THIS team (via new many-to-many)
    if (c.organizations?.some(o => o.organization.id === organizationId)) return false
    // Check legacy organizationId
    if (c.organizationId === organizationId) return false
    // Also respect existingCategoryIds prop
    if (existingCategoryIds.includes(c.id)) return false
    return true
  })

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedCategoryId("")
      setSelectedMemberIds(members.map(m => m.user.id))
    }
  }, [open, members])

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategoryId) return

    setIsSubmitting(true)
    try {
      // Just send the single new organizationId - the API will handle adding it
      // Don't try to preserve old organization links, they might point to deleted teams
      const res = await fetch(`/api/categories/${selectedCategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationIds: [organizationId], // Just the new team
          memberIds: selectedMemberIds,
        }),
      })

      if (res.ok) {
        onOpenChange(false)
        onSuccess()
      } else {
        const data = await res.json()
        console.error("Error response:", data)
      }
    } catch (error) {
      console.error("Error sharing category:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCategory = availableCategories.find(c => c.id === selectedCategoryId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Udostępnij istniejącą kategorię
          </DialogTitle>
          <DialogDescription>
            Wybierz swoją kategorię, aby udostępnić ją członkom zespołu
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {availableCategories.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nie masz żadnych kategorii do udostępnienia. Wszystkie Twoje kategorie są już udostępnione lub nie masz jeszcze żadnych kategorii.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Wybierz kategorię</Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz kategorię..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategory && members.length > 0 && (
                  <div className="space-y-2">
                    <Label>Członkowie z dostępem</Label>
                    <p className="text-sm text-muted-foreground">
                      Wybierz, którzy członkowie będą widzieć tę kategorię
                    </p>
                    <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`member-${member.id}`}
                            checked={selectedMemberIds.includes(member.user.id)}
                            onCheckedChange={() => toggleMember(member.user.id)}
                          />
                          <label
                            htmlFor={`member-${member.id}`}
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedCategoryId || availableCategories.length === 0}
            >
              {isSubmitting ? "Zapisywanie..." : "Udostępnij"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
