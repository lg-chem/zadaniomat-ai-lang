import useSWR, { useSWRConfig } from "swr"
import { toast } from "sonner"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { Task } from "@/hooks/use-tasks"
import { htmlToPlainText } from "@/lib/rich-text"
import {
  dropQueuedNote,
  getQueuedNote,
  isOfflineStorageAvailable,
  loadNoteList,
  newNoteId,
  queueNoteChange,
  saveNoteList,
  useNoteOutboxStore,
  type NoteOutboxEntry,
  type QueuedNoteFields,
} from "@/lib/note-outbox"

export interface Note {
  id: string
  title: string
  content: string | null
  isPinned: boolean
  createdAt: string
  updatedAt: string
  // Written or changed without internet - waits on the device to be sent
  pending?: boolean
}

export interface NoteTask {
  id: string
  title: string
  status: string
  scheduledDate: string | null
  scheduledTime: string | null
}

export interface NoteDetail extends Note {
  tasks: NoteTask[]
}

// A task whose description shows up in the notes feed
export interface TaskNote extends Task {
  descriptionUpdatedAt?: string | null
  updatedAt: string
}

// Text a task can be made from: a note or another task's description
export type TaskTextSource = { kind: "note" | "task"; id: string }

export interface NoteTaskInput {
  title: string
  description?: string | null
  scheduledDate?: string | null
  scheduledTime?: string | null
  plannedMinutes?: number | null
  categoryId?: string | null
}

const NOTES_KEY = "/api/notes"

export function useNotesWorkspace(): "WORK" | "PRIVATE" {
  const { workspace } = useWorkspaceStore()
  return workspace === "PRIVATE" ? "PRIVATE" : "WORK"
}

const withQuery = (base: string, workspace: string, q: string) => {
  const params = new URLSearchParams({ workspace })
  if (q.trim()) params.set("q", q.trim())
  return `${base}?${params.toString()}`
}

const sortNotes = (notes: Note[]) =>
  [...notes].sort(
    (a, b) => Number(b.isPinned) - Number(a.isPinned) || (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)
  )

const matchesQuery = (note: Pick<Note, "title" | "content">, q: string) => {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return note.title.toLowerCase().includes(needle) || htmlToPlainText(note.content).toLowerCase().includes(needle)
}

// The list as it is on the device: notes and changes not sent yet are shown too
function withQueuedChanges(notes: Note[], entries: NoteOutboxEntry[], workspace: string, q: string): Note[] {
  const queued = entries.filter((e) => e.workspaceType === workspace)
  if (queued.length === 0) return notes

  const byId = new Map(queued.map((e) => [e.id, e]))
  const result = notes.map((note) => {
    const entry = byId.get(note.id)
    if (!entry) return note
    byId.delete(note.id)
    return { ...note, ...entry.fields, updatedAt: entry.updatedAt, pending: true } as Note
  })
  for (const entry of byId.values()) {
    if (!entry.isNew) continue
    const note: Note = {
      id: entry.id,
      title: entry.fields.title ?? "",
      content: entry.fields.content ?? null,
      isPinned: entry.fields.isPinned ?? false,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      pending: true,
    }
    if (matchesQuery(note, q)) result.push(note)
  }
  return sortNotes(result)
}

// Own notes, pinned first. Without internet: the last list seen online.
export function useNotes(q = "") {
  const workspace = useNotesWorkspace()
  const { data, error, isLoading, mutate } = useSWR<Note[]>(withQuery(NOTES_KEY, workspace, q), {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })
  const entries = useNoteOutboxStore((s) => s.entries)
  const [saved, setSaved] = useState<{ workspace: string; notes: Note[] } | null>(null)

  // The list kept on the device, for opening the app offline
  useEffect(() => {
    let active = true
    loadNoteList<Note>(workspace).then((notes) => {
      if (active && notes) setSaved({ workspace, notes })
    })
    return () => {
      active = false
    }
  }, [workspace])

  useEffect(() => {
    if (!data || q.trim()) return
    const serverNotes = data.filter((n) => !n.pending)
    void saveNoteList(workspace, serverNotes)
    setSaved({ workspace, notes: serverNotes })
  }, [data, q, workspace])

  const notes = useMemo(() => {
    const offline = typeof navigator !== "undefined" && !navigator.onLine
    const kept = saved?.workspace === workspace ? saved.notes.filter((n) => matchesQuery(n, q)) : null
    const base = data ?? (error || offline ? kept : null) ?? []
    return withQueuedChanges(base, entries, workspace, q)
  }, [data, error, saved, entries, workspace, q])

  return { notes, isLoading: isLoading && notes.length === 0, isError: error, mutate }
}

// Task descriptions, most recently written first
export function useTaskNotes(q = "") {
  const workspace = useNotesWorkspace()
  const { data, error, isLoading, mutate } = useSWR<TaskNote[]>(withQuery("/api/tasks/notes", workspace, q), {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })
  return { taskNotes: data ?? [], isLoading, isError: error, mutate }
}

// A network error (no internet), not an answer from the server
const isNetworkError = (error: unknown) => error instanceof TypeError

// Notes being created right now - their changes wait until they exist on the server
const creatingNotes = new Map<string, Promise<void>>()

export function useNoteDetail(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<NoteDetail>(id ? `${NOTES_KEY}/${id}` : null, {
    revalidateOnFocus: false,
  })
  return { note: data ?? null, isLoading, isError: error, mutate }
}

async function readError(res: Response, fallback: string) {
  try {
    const body = await res.json()
    return typeof body?.error === "string" ? body.error : fallback
  } catch {
    return fallback
  }
}

export function useNoteActions() {
  const { mutate } = useSWRConfig()
  const workspace = useNotesWorkspace()

  const isNotesKey = (key: unknown) => typeof key === "string" && key.startsWith(NOTES_KEY)
  const revalidate = useCallback(() => mutate(isNotesKey), [mutate])

  // Without internet the note is kept on the device and sent when the connection is back
  const queueNew = useCallback(
    async (id: string, input: { title?: string; content?: string | null }): Promise<Note> => {
      const entry = await queueNoteChange({
        id,
        isNew: true,
        workspaceType: workspace,
        fields: { title: input.title ?? "", content: input.content ?? null },
      })
      return {
        id,
        title: entry.fields.title ?? "",
        content: entry.fields.content ?? null,
        isPinned: false,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        pending: true,
      }
    },
    [workspace]
  )

  // The note is shown and can be written in right away; it's saved in the background.
  // If saving fails, it waits on the device and is sent later - never lost.
  const createNote = useCallback(
    async (input: { title?: string; content?: string | null } = {}): Promise<Note> => {
      // Own id - if the answer is lost, sending again doesn't make a copy
      const id = newNoteId()
      const canWaitOffline = isOfflineStorageAvailable()
      if (canWaitOffline && !navigator.onLine) return queueNew(id, input)

      const now = new Date().toISOString()
      const note: Note = {
        id,
        title: input.title ?? "",
        content: input.content ?? null,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
      }
      const listKey = withQuery(NOTES_KEY, workspace, "")
      mutate(listKey, (current?: Note[]) => sortNotes([note, ...(current ?? []).filter((n) => n.id !== id)]), {
        revalidate: false,
      })

      const save = async () => {
        let res: Response
        try {
          res = await fetch(NOTES_KEY, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, id, workspaceType: workspace }),
          })
        } catch (error) {
          if (canWaitOffline && isNetworkError(error)) return void (await queueNew(id, input))
          throw error
        }
        // Server trouble - try again later from the device
        if (res.status >= 500 && canWaitOffline) return void (await queueNew(id, input))
        if (!res.ok) throw new Error(await readError(res, "Nie udało się dodać notatki"))
      }

      const saving: Promise<void> = save()
        .then(async () => {
          await revalidate()
        })
        .catch((error) => {
          mutate(listKey, (current?: Note[]) => current?.filter((n) => n.id !== id), { revalidate: false })
          toast.error(error instanceof Error ? error.message : "Nie udało się dodać notatki")
        })
        .finally(() => creatingNotes.delete(id))
      creatingNotes.set(id, saving)
      return note
    },
    [workspace, revalidate, queueNew, mutate]
  )

  const updateNote = useCallback(
    async (id: string, input: Partial<Pick<Note, "title" | "content" | "isPinned">>) => {
      // The list shows the change right away
      mutate(
        (key) => typeof key === "string" && key.startsWith(`${NOTES_KEY}?`),
        (current?: Note[]) =>
          current?.map((n) => (n.id === id ? { ...n, ...input, updatedAt: new Date().toISOString() } : n)),
        { revalidate: false }
      )
      // A note added a moment ago - change it once it's created
      await creatingNotes.get(id)

      // Kept on the device: without internet, and while earlier changes of the note
      // still wait - so they're sent in order and a newer text isn't overwritten
      const queue = async () => {
        const entry = await queueNoteChange({ id, isNew: false, workspaceType: workspace, fields: input as QueuedNoteFields })
        return { id, ...entry.fields, updatedAt: entry.updatedAt, pending: true } as Note
      }
      const canWaitOffline = isOfflineStorageAvailable()
      if (canWaitOffline && (!navigator.onLine || (await getQueuedNote(id)))) return queue()

      let res: Response
      try {
        res = await fetch(`${NOTES_KEY}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      } catch (error) {
        if (canWaitOffline && isNetworkError(error)) return queue()
        throw error
      }
      if (!res.ok) {
        revalidate()
        throw new Error(await readError(res, "Nie udało się zapisać notatki"))
      }
      if (input.isPinned !== undefined) revalidate()
      return (await res.json()) as Note
    },
    [mutate, revalidate, workspace]
  )

  const deleteNote = useCallback(
    async (id: string) => {
      await creatingNotes.get(id)
      const queued = isOfflineStorageAvailable() ? await getQueuedNote(id) : null
      // Not sent yet - it's enough to forget it on the device
      if (queued?.isNew) {
        await dropQueuedNote(id)
        await revalidate()
        return
      }

      let res: Response
      try {
        res = await fetch(`${NOTES_KEY}/${id}`, { method: "DELETE" })
      } catch (error) {
        if (isNetworkError(error)) throw new Error("Brak internetu - notatkę usuniesz, gdy wróci połączenie")
        throw error
      }
      if (!res.ok) throw new Error(await readError(res, "Nie udało się usunąć notatki"))
      // Changes waiting for a deleted note have nowhere to go
      if (queued) await dropQueuedNote(id)
      await revalidate()
    },
    [revalidate]
  )

  const createTaskFromText = useCallback(
    async (source: TaskTextSource, input: NoteTaskInput) => {
      const url = source.kind === "note" ? `${NOTES_KEY}/${source.id}/tasks` : `/api/tasks/${source.id}/from-description`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await readError(res, "Nie udało się utworzyć zadania"))
      const task = (await res.json()) as NoteTask
      if (source.kind === "note") mutate(`${NOTES_KEY}/${source.id}`)
      mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"))
      return task
    },
    [mutate]
  )

  return { createNote, updateNote, deleteNote, createTaskFromText }
}
