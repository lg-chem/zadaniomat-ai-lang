"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Briefcase, Check, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { usePlanViewStore } from "@/stores/plan-view-store"
import type { Task } from "@/hooks/use-tasks"
import type { BlockData } from "@/hooks/use-schedule-blocks"

interface Item {
  key: string
  time: string | null
  endTime?: string
  title: string
  color?: string | null
  done?: boolean
  isTask: boolean
}

/**
 * The same day in the other workspace - work while planning the private day, private
 * while planning work - so both fit in one day. Shown on request, read only:
 * the tasks are changed in their own workspace.
 */
export function OtherWorkspaceDay({ date }: { date: string }) {
  const { workspace } = useWorkspaceStore()
  const show = usePlanViewStore((s) => s.showOtherWorkspace)
  const setShow = usePlanViewStore((s) => s.setShowOtherWorkspace)
  const other = workspace === "WORK" ? "PRIVATE" : workspace === "PRIVATE" ? "WORK" : null

  const { data: tasks } = useSWR<Task[]>(
    show && other ? `/api/tasks?workspace=${other}&date=${date}&includeAssigned=true` : null,
    { keepPreviousData: true }
  )
  const { data: blocks } = useSWR<{ blocks: BlockData[] }>(
    show && other ? `/api/schedule-blocks?workspace=${other}&date=${date}` : null,
    { keepPreviousData: true }
  )

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...(blocks?.blocks ?? []).map((block, i) => ({
        key: `block-${i}-${block.startTime}`,
        time: block.startTime,
        endTime: block.endTime,
        title: block.name,
        color: block.color,
        isTask: false,
      })),
      ...(tasks ?? [])
        .filter((task) => task.status !== "CANCELLED")
        .map((task) => ({
          key: `task-${task.id}`,
          time: task.scheduledTime ?? null,
          title: task.title,
          color: task.category?.color,
          done: task.status === "COMPLETED",
          isTask: true,
        })),
    ]
    // With an hour first, in the order of the day
    return all.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time) return -1
      if (b.time) return 1
      return 0
    })
  }, [tasks, blocks])

  if (!other) return null
  const Icon = other === "WORK" ? Briefcase : User
  const hasTimes = items.some((item) => item.time)

  return (
    <Card>
      <CardContent className="p-3">
        <label className="flex min-h-[2.75rem] items-center justify-between gap-3 px-1 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
            Pokaż też {other === "WORK" ? "pracę" : "prywatne"} w tym dniu
          </span>
          <Switch checked={show} onCheckedChange={setShow} />
        </label>
        {show &&
          (items.length === 0 ? (
            <p className="px-1 pb-1 text-sm text-muted-foreground">
              {tasks && blocks ? `Nic zaplanowanego w zakładce ${other === "WORK" ? "Praca" : "Prywatne"}.` : "Wczytuję…"}
            </p>
          ) : (
            <ul className="mt-1 text-muted-foreground">
              {items.map((item) => (
                <li key={item.key} className="flex min-h-[2.25rem] items-center gap-2.5 px-1 py-1">
                  {hasTimes && <span className="w-11 flex-shrink-0 text-xs tabular-nums">{item.time ?? ""}</span>}
                  {item.isTask ? (
                    <span
                      className={cn(
                        "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2",
                        item.done ? "border-transparent bg-muted-foreground/50 text-background" : "border-muted-foreground/40"
                      )}
                    >
                      {item.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                  ) : (
                    <span className="h-5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color ?? "#6366f1" }} />
                  )}
                  <span className={cn("min-w-0 flex-1 truncate text-sm", item.done && "line-through")}>
                    {item.title}
                    {!item.isTask && item.endTime && <span className="text-xs"> · do {item.endTime}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </CardContent>
    </Card>
  )
}
