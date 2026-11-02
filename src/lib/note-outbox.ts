"use client"

import { create } from "zustand"

// Notes written without internet wait on the device in an "outbox" and are sent
// when the connection is back - by the service worker (public/sw.js), also in the
// background on Android. The database layout below must match the one in sw.js.

const DB_NAME = "zadaniomat-offline"
const DB_VERSION = 1
const OUTBOX = "note-outbox"
const LISTS = "note-lists"
const SYNC_TAG = "notes-outbox"

export type NotesWorkspace = "WORK" | "PRIVATE"

export interface QueuedNoteFields {
  title?: string
  content?: string | null
  isPinned?: boolean
}

// One note waiting to be sent: a new note, or changes to an existing one
export interface NoteOutboxEntry {
  id: string
  isNew: boolean
  workspaceType: NotesWorkspace
  fields: QueuedNoteFields
  createdAt: string // when a new note was written
  updatedAt: string // last change on the device
  queuedAt: number // keeps the sending order
  rev: number // grows with each change - a change made while sending isn't lost
}

// Last result of sending, reported by the service worker
export type NoteSyncResult = "done" | "offline" | "auth" | "error"

interface NoteOutboxState {
  entries: NoteOutboxEntry[]
  lastResult: NoteSyncResult | null
}

export const useNoteOutboxStore = create<NoteOutboxState>(() => ({ entries: [], lastResult: null }))

// Same id format as the server (cuid-like) - the note keeps it after sending
export function newNoteId() {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("")
  return `c${Date.now().toString(36)}${random}`
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "id" })
        if (!db.objectStoreNames.contains(LISTS)) db.createObjectStore(LISTS, { keyPath: "key" })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const isOfflineStorageAvailable = () =>
  typeof window !== "undefined" && "indexedDB" in window && "serviceWorker" in navigator

export async function readOutbox(): Promise<NoteOutboxEntry[]> {
  const db = await openDb()
  const entries = await done(db.transaction(OUTBOX).objectStore(OUTBOX).getAll())
  return (entries as NoteOutboxEntry[]).sort((a, b) => a.queuedAt - b.queuedAt)
}

export async function reloadOutbox() {
  if (!isOfflineStorageAvailable()) return
  try {
    useNoteOutboxStore.setState({ entries: await readOutbox() })
  } catch (error) {
    console.error("Could not read the notes outbox:", error)
  }
}

export async function getQueuedNote(id: string): Promise<NoteOutboxEntry | null> {
  const db = await openDb()
  return ((await done(db.transaction(OUTBOX).objectStore(OUTBOX).get(id))) as NoteOutboxEntry | undefined) ?? null
}

// Keeps a note (or its change) on the device and sends it when possible.
// Changes to the same note are merged into one entry.
export async function queueNoteChange(change: {
  id: string
  isNew: boolean
  workspaceType: NotesWorkspace
  fields: QueuedNoteFields
}): Promise<NoteOutboxEntry> {
  const db = await openDb()
  const tx = db.transaction(OUTBOX, "readwrite")
  const store = tx.objectStore(OUTBOX)
  const existing = (await done(store.get(change.id))) as NoteOutboxEntry | undefined
  const now = new Date().toISOString()
  const entry: NoteOutboxEntry = {
    id: change.id,
    isNew: existing ? existing.isNew : change.isNew,
    workspaceType: existing?.workspaceType ?? change.workspaceType,
    fields: { ...existing?.fields, ...change.fields },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    queuedAt: existing?.queuedAt ?? Date.now(),
    rev: (existing?.rev ?? 0) + 1,
  }
  store.put(entry)
  await committed(tx)

  await reloadOutbox()
  requestNoteSync()
  return entry
}

// A new note deleted before it was sent - nothing to send any more
export async function dropQueuedNote(id: string) {
  const db = await openDb()
  const tx = db.transaction(OUTBOX, "readwrite")
  tx.objectStore(OUTBOX).delete(id)
  await committed(tx)
  await reloadOutbox()
}

// Asks the service worker to send the outbox: with Background Sync (Android)
// it also happens later, when the app is closed; otherwise right away
export function requestNoteSync() {
  if (!isOfflineStorageAvailable()) return
  navigator.serviceWorker.ready
    .then(async (registration) => {
      const sync = (registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> }
      }).sync
      if (sync) {
        try {
          await sync.register(SYNC_TAG)
          // Background Sync waits for a connection itself; when online send right away too
          if (!navigator.onLine) return
        } catch {
          // Not allowed (e.g. not installed) - send directly below
        }
      }
      registration.active?.postMessage({ type: "flush-notes" })
    })
    .catch((error) => console.error("Could not request notes sync:", error))
}

// Last notes list seen online - shown when the app is opened without internet
export async function saveNoteList<T>(workspace: NotesWorkspace, notes: T[]) {
  if (!isOfflineStorageAvailable()) return
  try {
    const db = await openDb()
    const tx = db.transaction(LISTS, "readwrite")
    tx.objectStore(LISTS).put({ key: `notes:${workspace}`, notes, savedAt: Date.now() })
    await committed(tx)
  } catch (error) {
    console.error("Could not keep notes for offline:", error)
  }
}

export async function loadNoteList<T>(workspace: NotesWorkspace): Promise<T[] | null> {
  if (!isOfflineStorageAvailable()) return null
  try {
    const db = await openDb()
    const saved = (await done(db.transaction(LISTS).objectStore(LISTS).get(`notes:${workspace}`))) as
      | { notes: T[] }
      | undefined
    return saved?.notes ?? null
  } catch {
    return null
  }
}

const isNotesKey = (key: unknown) => typeof key === "string" && key.startsWith("/api/notes")

// Runs once per page: sends waiting notes when the app opens or the connection
// returns, and refreshes the notes lists when the service worker has sent them
export function startNoteSync(refreshNotes: (isKey: (key: unknown) => boolean) => void) {
  if (!isOfflineStorageAvailable()) return () => {}

  const sendIfWaiting = async () => {
    await reloadOutbox()
    if (useNoteOutboxStore.getState().entries.length > 0) requestNoteSync()
  }

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type !== "notes-synced") return
    useNoteOutboxStore.setState({ lastResult: event.data.result as NoteSyncResult })
    void reloadOutbox()
    if (event.data.sent > 0 || event.data.dropped > 0) refreshNotes(isNotesKey)
  }

  const handleVisible = () => {
    if (document.visibilityState === "visible") void sendIfWaiting()
  }

  // Asks the browser not to clear the app's data when the phone runs low on space -
  // notes waiting to be sent live there (an installed app gets it without asking)
  navigator.storage
    ?.persisted?.()
    .then((persisted) => (persisted ? true : navigator.storage.persist?.()))
    .catch(() => {})

  navigator.serviceWorker.addEventListener("message", handleMessage)
  window.addEventListener("online", sendIfWaiting)
  document.addEventListener("visibilitychange", handleVisible)
  void sendIfWaiting()

  return () => {
    navigator.serviceWorker.removeEventListener("message", handleMessage)
    window.removeEventListener("online", sendIfWaiting)
    document.removeEventListener("visibilitychange", handleVisible)
  }
}
