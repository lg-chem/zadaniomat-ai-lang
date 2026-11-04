"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SaveStatus } from "@/components/editor/document-editor-dialog"
import { isEmptyRichText } from "@/lib/rich-text"
import { clearEntryBackup, writeEntryBackup } from "./draft-backup"
import type { EntryDraft, KnowledgeEntry } from "./types"

const SAVE_DELAY = 1000
const RETRY_DELAY = 5000

export function draftHasText(draft: Pick<EntryDraft, "title" | "content">): boolean {
  return !!draft.title.trim() || !isEmptyRichText(draft.content)
}

class SaveError extends Error {
  constructor(message: string, readonly retry: boolean) {
    super(message)
  }
}

async function readError(res: Response, fallback: string) {
  try {
    const body = await res.json()
    return typeof body?.error === "string" ? body.error : fallback
  } catch {
    return fallback
  }
}

interface Options {
  entry: KnowledgeEntry | null
  initialDraft: EntryDraft
  // Fields not saved yet (e.g. restored from the device)
  initialDirty?: Partial<EntryDraft>
  // Id for a new entry - sent with the first save, so a repeat doesn't make a copy
  clientId: string
  workspace: string
  onSaved: (entry: KnowledgeEntry) => void
}

// Saves a knowledge entry while it's written: 1 s after typing, right away for settings,
// one save at a time. A new entry is created with the first text. Whatever can't be sent
// waits on the device (see draft-backup) and is retried.
export function useEntryAutosave({ entry, initialDraft, initialDirty, clientId, workspace, onSaved }: Options) {
  const idRef = useRef<string | null>(entry?.id ?? null)
  const [entryId, setEntryId] = useState<string | null>(idRef.current)
  const draftRef = useRef<EntryDraft>(initialDraft)
  const dirtyRef = useRef<Partial<EntryDraft>>(initialDirty ?? {})
  const chainRef = useRef<Promise<unknown>>(Promise.resolve())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Title or text already saved in this session - the version from its start is kept, not one per save
  const textSavedRef = useRef(false)
  // Something was saved since the AI search index was last refreshed
  const needsReindexRef = useRef(false)
  const createdHereRef = useRef(false)
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  const keepOnDevice = useCallback(() => {
    writeEntryBackup({
      entryId: idRef.current,
      clientId,
      workspace,
      draft: draftRef.current,
      savedAt: new Date().toISOString(),
    })
  }, [clientId, workspace])

  const isDirty = () => Object.keys(dirtyRef.current).length > 0

  const schedule = useCallback((delay: number, run: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(run, delay)
  }, [])

  const saveOnce = useCallback(
    async (reindexWanted: boolean): Promise<boolean> => {
      const fields = dirtyRef.current
      const draft = draftRef.current
      const isNew = !idRef.current
      const textChanged = "title" in fields || "content" in fields
      const reindex = reindexWanted && !isNew && (needsReindexRef.current || textChanged)
      if (!isDirty() && !reindex) return true
      // Nothing worth keeping yet (new or emptied entry) - waits for text
      if (!draftHasText(draft)) return true

      dirtyRef.current = {}
      setStatus("saving")

      try {
        let res: Response
        try {
          res = isNew
            ? await fetch("/api/knowledge/entries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: clientId, ...draft, workspace, autosave: !reindexWanted }),
              })
            : await fetch(`/api/knowledge/entries/${idRef.current}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...fields,
                  autosave: true,
                  snapshot: !textSavedRef.current,
                  ...(reindex && { reindex: true }),
                }),
              })
        } catch {
          throw new SaveError("Brak połączenia - zapiszę, gdy wróci internet", true)
        }
        if (!res.ok) {
          throw new SaveError(await readError(res, "Nie udało się zapisać wpisu"), res.status >= 500)
        }

        const saved = (await res.json()) as KnowledgeEntry
        if (isNew) {
          createdHereRef.current = true
          idRef.current = saved.id
          setEntryId(saved.id)
        }
        if (isNew || textChanged) textSavedRef.current = true
        // A new entry sent at the end of writing is indexed by the server right away
        if (reindex || (isNew && reindexWanted)) needsReindexRef.current = false
        else if (isNew || textChanged) needsReindexRef.current = true
        onSavedRef.current(saved)

        if (!isDirty()) {
          clearEntryBackup(saved.id)
          setStatus("saved")
          setError(null)
        }
        return true
      } catch (err) {
        // Keep what wasn't saved (newer changes win) and the text on the device
        dirtyRef.current = { ...fields, ...dirtyRef.current }
        const saveError = err instanceof SaveError ? err : new SaveError("Nie udało się zapisać wpisu", true)
        setStatus("error")
        setError(saveError.message)
        keepOnDevice()
        if (saveError.retry) schedule(RETRY_DELAY, () => void flush())
        return false
      }
    },
    // flush is defined below and only called later
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientId, workspace, keepOnDevice, schedule]
  )

  // Saves what's waiting; with reindex also refreshes the AI search index (end of writing)
  const flush = useCallback(
    (options: { reindex?: boolean } = {}): Promise<boolean> => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      const run = chainRef.current.then(() => saveOnce(!!options.reindex))
      chainRef.current = run.catch(() => {})
      return run
    },
    [saveOnce]
  )

  const change = useCallback(
    (fields: Partial<EntryDraft>, immediate = false) => {
      draftRef.current = { ...draftRef.current, ...fields }
      dirtyRef.current = { ...dirtyRef.current, ...fields }
      schedule(immediate ? 0 : SAVE_DELAY, () => void flush())
    },
    [flush, schedule]
  )

  // Restored text is sent right away
  useEffect(() => {
    if (isDirty()) void flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Back online - send what waits
  useEffect(() => {
    const onOnline = () => {
      if (isDirty()) void flush()
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [flush])

  // Closing the tab with unsaved text: keep it and ask the browser to warn
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty() || !draftHasText(draftRef.current)) return
      keepOnDevice()
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [keepOnDevice])

  // Leaving the page with the editor open - last changes go out in the background
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (!isDirty() || !draftHasText(draftRef.current)) return
      keepOnDevice()
      const body = idRef.current
        ? JSON.stringify({ ...dirtyRef.current, autosave: true, snapshot: !textSavedRef.current, reindex: true })
        : JSON.stringify({ id: clientId, ...draftRef.current, workspace })
      if (body.length > 60_000) return
      fetch(idRef.current ? `/api/knowledge/entries/${idRef.current}` : "/api/knowledge/entries", {
        method: idRef.current ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {})
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return {
    entryId,
    status,
    error,
    change,
    flush,
    draft: () => draftRef.current,
    isDirty,
    createdHere: () => createdHereRef.current,
    // Changes that won't be saved (e.g. an emptied entry closed without deleting)
    discard: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      dirtyRef.current = {}
    },
  }
}
