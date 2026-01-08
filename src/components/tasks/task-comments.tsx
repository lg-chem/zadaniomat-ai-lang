"use client"

import { useState, useEffect, useRef } from "react"
import { Send, Trash2, Edit2, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

interface CommentUser {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  user: CommentUser
}

interface TaskCommentsProps {
  taskId: string
  currentUserId: string
  isTaskOwner: boolean
}

export function TaskComments({ taskId, currentUserId, isTaskOwner }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/comments`)
        if (res.ok) {
          const data = await res.json()
          setComments(data)
        }
      } catch (error) {
        console.error("Error fetching comments:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchComments()
  }, [taskId])

  // Scroll to bottom when new comments are added
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments])

  const handleSendComment = async () => {
    if (!newComment.trim() || isSending) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      })

      if (res.ok) {
        const comment = await res.json()
        setComments([...comments, comment])
        setNewComment("")
      }
    } catch (error) {
      console.error("Error sending comment:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten komentarz?")) return

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setComments(comments.filter(c => c.id !== commentId))
      }
    } catch (error) {
      console.error("Error deleting comment:", error)
    }
  }

  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id)
    setEditingContent(comment.content)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingContent.trim()) {
      setEditingId(null)
      return
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingContent.trim() }),
      })

      if (res.ok) {
        const updatedComment = await res.json()
        setComments(comments.map(c => c.id === editingId ? updatedComment : c))
        setEditingId(null)
      }
    } catch (error) {
      console.error("Error updating comment:", error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendComment()
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-20 bg-muted animate-pulse rounded" />
        <div className="h-20 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto space-y-3 p-3 max-h-[300px]">
        {comments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">Brak komentarzy</p>
            <p className="text-xs mt-1">Rozpocznij dyskusję dodając pierwszy komentarz</p>
          </div>
        ) : (
          comments.map((comment) => {
            const isOwn = comment.user.id === currentUserId
            const canDelete = isOwn || isTaskOwner

            return (
              <div
                key={comment.id}
                className={cn(
                  "flex gap-2",
                  isOwn && "flex-row-reverse"
                )}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={comment.user.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(comment.user.name, comment.user.email)}
                  </AvatarFallback>
                </Avatar>

                <div className={cn("flex-1 max-w-[80%]", isOwn && "text-right")}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs font-medium", isOwn && "order-2")}>
                      {comment.user.name || comment.user.email}
                    </span>
                    <span className={cn("text-xs text-muted-foreground", isOwn && "order-1")}>
                      {format(new Date(comment.createdAt), "d MMM, HH:mm", { locale: pl })}
                    </span>
                  </div>

                  {editingId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="text-sm min-h-[60px]"
                        autoFocus
                      />
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                          isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {comment.content}
                      </div>

                      {(isOwn || canDelete) && (
                        <div className={cn(
                          "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                          isOwn ? "-left-14" : "-right-14"
                        )}>
                          {isOwn && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleStartEdit(comment)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napisz komentarz... (Enter aby wysłać)"
            className="text-sm min-h-[40px] max-h-[100px] resize-none"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSendComment}
            disabled={!newComment.trim() || isSending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
