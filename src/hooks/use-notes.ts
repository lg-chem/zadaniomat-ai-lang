import useSWR, { useSWRConfig } from "swr"
import { useCallback } from "react"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { Task } from "@/hooks/use-tasks"

export interface Note {
  id: string
  title: string
  content: string | null
  isPinned: boolean
  createdAt: string
  updatedAt: string
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

// Own notes, pinned first
export function useNotes(q = "") {
  const workspace = useNotesWorkspace()
  const { data, error, isLoading, mutate } = useSWR<Note[]>(withQuery(NOTES_KEY, workspace, q), {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })
  return { notes: data ?? [], isLoading, isError: error, mutate }
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

  const createNote = useCallback(
    async (input: { title?: string; content?: string | null } = {}) => {
      const res = await fetch(NOTES_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, workspaceType: workspace }),
      })
      if (!res.ok) throw new Error(await readError(res, "Nie udało się dodać notatki"))
      const note = (await res.json()) as Note
      await revalidate()
      return note
    },
    [workspace, revalidate]
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
      const res = await fetch(`${NOTES_KEY}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        revalidate()
        throw new Error(await readError(res, "Nie udało się zapisać notatki"))
      }
      if (input.isPinned !== undefined) revalidate()
      return (await res.json()) as Note
    },
    [mutate, revalidate]
  )

  const deleteNote = useCallback(
    async (id: string) => {
      const res = await fetch(`${NOTES_KEY}/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await readError(res, "Nie udało się usunąć notatki"))
      await revalidate()
    },
    [revalidate]
  )

  const createTaskFromNote = useCallback(
    async (noteId: string, input: NoteTaskInput) => {
      const res = await fetch(`${NOTES_KEY}/${noteId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await readError(res, "Nie udało się utworzyć zadania"))
      const task = (await res.json()) as NoteTask
      mutate(`${NOTES_KEY}/${noteId}`)
      mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"))
      return task
    },
    [mutate]
  )

  return { createNote, updateNote, deleteNote, createTaskFromNote }
}
