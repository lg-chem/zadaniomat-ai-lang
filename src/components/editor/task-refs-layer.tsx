"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import useSWR, { useSWRConfig } from "swr"
import { useEditorState, type Editor } from "@tiptap/react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { toast } from "sonner"
import { Check, CheckCircle2, Circle, CircleDashed, ExternalLink, ListPlus, RotateCcw, Unlink, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { stopTimerForTask } from "@/lib/timer-actions"
import { formatDayShort } from "@/lib/task-recurrence"
import { cn } from "@/lib/utils"
import { TASK_REF_OPEN_EVENT, setTaskRefTasks, type TaskRefInfo, type TaskRefTasks } from "./task-ref"
import { removeTaskRef, taskRefIds } from "./task-ref-text"

const STATUS_LABELS: Record<string, string> = {
  NEW: "Do zrobienia",
  IN_PROGRESS: "W trakcie",
  COMPLETED: "Zrobione",
  CANCELLED: "Anulowane",
  TO_TRANSFER: "Do przeniesienia",
}

type VirtualAnchor = { getBoundingClientRect: () => DOMRect; contextElement?: Element }

const floatingClass =
  "z-50 rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"

// Ids of linked tasks in the editor ("a,b,c"), updated when the text changes
function useTaskRefIds(editor: Editor | null) {
  const [ids, setIds] = useState("")
  useEffect(() => {
    if (!editor) return
    const update = () => {
      if (!editor.isDestroyed) setIds(taskRefIds(editor.state.doc).slice(0, 100).join(","))
    }
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) update()
    }
    update()
    editor.on("transaction", onTransaction)
    return () => {
      editor.off("transaction", onTransaction)
    }
  }, [editor])
  return ids
}

function taskIcon(task: TaskRefInfo | null | undefined, className: string) {
  if (task === null) return <CircleDashed className={cn(className, "text-muted-foreground")} />
  if (task?.status === "COMPLETED") return <CheckCircle2 className={cn(className, "text-green-600")} />
  if (task?.status === "CANCELLED") return <XCircle className={cn(className, "text-muted-foreground")} />
  return <Circle className={cn(className, "text-muted-foreground")} />
}

interface TaskRefsLayerProps {
  editor: Editor | null
  // Shows a "Zadanie" button under selected text
  onCreateTask?: () => void
  // E.g. while the dialog for a new task is open
  hideBubble?: boolean
}

// Tasks linked in the text: live status (crossed out when done), a card with
// Gotowe / Otwórz / Odłącz after clicking the round icon, and "Zadanie" under a selection.
export function TaskRefsLayer({ editor, onCreateTask, hideBubble }: TaskRefsLayerProps) {
  const { mutate: globalMutate } = useSWRConfig()
  const ids = useTaskRefIds(editor)
  // Data always matches the current ids, so a task missing from it is really gone
  const { data, mutate } = useSWR<TaskRefInfo[]>(ids ? `/api/tasks/refs?ids=${ids}` : null, {
    keepPreviousData: false,
    revalidateOnFocus: true,
  })

  useEffect(() => {
    if (!editor || !data || !ids) return
    const tasks: TaskRefTasks = {}
    for (const id of ids.split(",")) tasks[id] = null
    for (const task of data) tasks[task.id] = task
    setTaskRefTasks(editor, tasks)
  }, [editor, data, ids])

  // ----- Card of a linked task -----
  const [openId, setOpenId] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!editor) return
    const onOpen = (event: Event) => {
      if (editor.isDestroyed || !(event.target instanceof Node) || !editor.view.dom.contains(event.target)) return
      const { taskId } = (event as CustomEvent<{ taskId: string }>).detail
      setOpenId((current) => (current === taskId ? null : taskId))
    }
    document.addEventListener(TASK_REF_OPEN_EVENT, onOpen)
    return () => document.removeEventListener(TASK_REF_OPEN_EVENT, onOpen)
  }, [editor])

  // The text with the task was deleted
  useEffect(() => {
    if (openId && !ids.split(",").includes(openId)) setOpenId(null)
  }, [ids, openId])

  const cardAnchor = useMemo<{ current: VirtualAnchor | null }>(() => {
    if (!editor || !openId || editor.isDestroyed) return { current: null }
    let lastRect = new DOMRect()
    return {
      current: {
        getBoundingClientRect: () => {
          // The icon is redrawn when the status changes, so look it up every time
          const icon = editor.isDestroyed
            ? null
            : editor.view.dom.querySelector(`[data-task-ref-open="${CSS.escape(openId)}"]`)
          if (icon) lastRect = icon.getBoundingClientRect()
          return lastRect
        },
        contextElement: editor.view.dom,
      },
    }
  }, [editor, openId])

  const task = openId && data ? (data.find((t) => t.id === openId) ?? null) : undefined
  const done = task?.status === "COMPLETED"
  const day = task?.scheduledDate?.slice(0, 10)

  const toggleDone = async (target: TaskRefInfo) => {
    const wasDone = target.status === "COMPLETED"
    const status = wasDone ? "NEW" : "COMPLETED"
    setIsBusy(true)
    try {
      if (!wasDone) await stopTimerForTask(target.id, { complete: true })
      const res = await fetch(`/api/tasks/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      await mutate((current) => current?.map((t) => (t.id === target.id ? { ...t, status } : t)), { revalidate: false })
      if (!wasDone) toast.success("Zadanie zrobione")
      setOpenId(null)
    } catch {
      toast.error("Nie udało się zmienić statusu")
    } finally {
      setIsBusy(false)
      // Task lists and the "tasks from this note" chips
      globalMutate((key) => typeof key === "string" && (key.startsWith("/api/tasks") || key.startsWith("/api/notes/")))
    }
  }

  // ----- "Zadanie" under a selection -----
  const selection = useEditorState({
    editor,
    selector: () => {
      const e = editor
      if (!e || e.isDestroyed || !onCreateTask || !e.isEditable || !e.isFocused) return null
      const { from, to, head, empty } = e.state.selection
      if (empty || !e.state.doc.textBetween(from, to, " ").trim()) return null
      return { from, to, head }
    },
  })
  const [dismissed, setDismissed] = useState<string | null>(null)
  const selectionKey = selection ? `${selection.from}-${selection.to}` : null
  const showBubble = !!selection && !!onCreateTask && !hideBubble && dismissed !== selectionKey
  const head = selection?.head ?? null
  // A new anchor for every selection makes the bubble follow it
  const bubbleAnchor = useMemo<{ current: VirtualAnchor | null }>(() => {
    if (!editor || head === null || editor.isDestroyed) return { current: null }
    return {
      current: {
        getBoundingClientRect: () => {
          if (editor.isDestroyed) return new DOMRect()
          const coords = editor.view.coordsAtPos(Math.min(head, editor.state.doc.content.size))
          return new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
        },
        contextElement: editor.view.dom,
      },
    }
  }, [editor, head])

  return (
    <>
      <PopoverPrimitive.Root
        open={!!openId && !!editor}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
      >
        <PopoverPrimitive.Anchor virtualRef={cardAnchor} />
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={16}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => {
              // Clicking an icon again switches or closes the card itself
              const target = e.detail.originalEvent.target
              if (target instanceof Element && target.closest("[data-task-ref-open]")) e.preventDefault()
            }}
            className={cn(floatingClass, "w-[min(20rem,calc(100vw-2rem))] p-3")}
          >
            {task === undefined ? (
              <p className="text-sm text-muted-foreground">Ładowanie zadania…</p>
            ) : task === null ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  {taskIcon(null, "mt-0.5 h-4 w-4 shrink-0")}
                  <p className="text-sm text-muted-foreground">Tego zadania już nie ma - zostało usunięte albo nie jest Twoje.</p>
                </div>
                {editor?.isEditable && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (editor && openId) removeTaskRef(editor, openId)
                      setOpenId(null)
                    }}
                  >
                    <Unlink className="mr-1.5 h-4 w-4" />
                    Usuń odnośnik
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  {taskIcon(task, "mt-0.5 h-4 w-4 shrink-0")}
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium leading-snug", done && "text-muted-foreground line-through")}>
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {STATUS_LABELS[task.status] ?? task.status}
                      {day && ` · ${formatDayShort(day)}`}
                      {task.scheduledTime && `, ${task.scheduledTime}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={done ? "outline" : "default"}
                    className="flex-1"
                    disabled={isBusy}
                    onClick={() => toggleDone(task)}
                  >
                    {done ? <RotateCcw className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
                    {done ? "Przywróć" : "Gotowe"}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link href={day ? `/schedule?date=${day}&task=${task.id}` : "/schedule"} onClick={() => setOpenId(null)}>
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      Otwórz
                    </Link>
                  </Button>
                  {editor?.isEditable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      title="Zostaw tekst, usuń odnośnik do zadania"
                      onClick={() => {
                        if (editor && openId) removeTaskRef(editor, openId)
                        setOpenId(null)
                      }}
                    >
                      <Unlink className="mr-1.5 h-4 w-4" />
                      Odłącz
                    </Button>
                  )}
                </div>
              </div>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {onCreateTask && (
        <PopoverPrimitive.Root
          open={showBubble}
          onOpenChange={(open) => {
            if (!open) setDismissed(selectionKey)
          }}
        >
          <PopoverPrimitive.Anchor virtualRef={bubbleAnchor} />
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              side="bottom"
              align="start"
              sideOffset={14}
              collisionPadding={16}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onFocusOutside={(e) => e.preventDefault()}
              className={cn(floatingClass, "p-1")}
            >
              <button
                type="button"
                // Keep the selection and the keyboard
                onMouseDown={(e) => e.preventDefault()}
                onClick={onCreateTask}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-muted"
              >
                <ListPlus className="h-4 w-4" />
                Zrób zadanie
              </button>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </>
  )
}
