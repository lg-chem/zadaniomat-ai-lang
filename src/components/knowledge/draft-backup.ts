import type { EntryDraft } from "./types"

// Text of a knowledge entry that couldn't be sent (no internet, server trouble, page closed
// mid-save). Kept on this device until it's saved, so writing is never lost.

const KEY = "knowledge-entry-backup:v1"

export interface EntryBackup {
  // Saved entry, or null when it wasn't created yet
  entryId: string | null
  // Id the new entry gets when it's finally sent
  clientId: string
  workspace: string
  draft: EntryDraft
  savedAt: string
}

export function readEntryBackup(): EntryBackup | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const backup = JSON.parse(raw) as EntryBackup
    return backup && backup.draft && backup.clientId ? backup : null
  } catch {
    return null
  }
}

export function writeEntryBackup(backup: EntryBackup) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(backup))
  } catch {
    // Storage full or blocked - nothing more to do here
  }
}

// Drops the backup of this entry (or any, without an id)
export function clearEntryBackup(id?: string | null) {
  try {
    if (id) {
      const current = readEntryBackup()
      if (current && current.entryId !== id && current.clientId !== id) return
    }
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
