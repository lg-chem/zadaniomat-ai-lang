import { create } from "zustand"
import { persist } from "zustand/middleware"

export type NavWorkspace = "WORK" | "PRIVATE"
export type NavOrder = Partial<Record<NavWorkspace, string[]>>

interface NavOrderState {
  // Tab links in the order the user set; missing - default order
  order: NavOrder
  // Changed on this device and not saved to the account yet
  unsynced: boolean
  setOrder: (workspace: NavWorkspace, hrefs: string[]) => void
  resetOrder: (workspace: NavWorkspace) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

// Saves the order to the account, so other devices get it too.
// Kept on this device anyway - also when the server can't save it.
function saveToAccount() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const { order } = useNavOrderStore.getState()
    try {
      const res = await fetch("/api/user/nav-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      })
      if (res.ok) useNavOrderStore.setState({ unsynced: false })
    } catch {
      // Offline - sent with the next change or the next start
    }
  }, 600)
}

export const useNavOrderStore = create<NavOrderState>()(
  persist(
    (set) => ({
      order: {},
      unsynced: false,
      setOrder: (workspace, hrefs) => {
        set((state) => ({ order: { ...state.order, [workspace]: hrefs }, unsynced: true }))
        saveToAccount()
      },
      resetOrder: (workspace) => {
        set((state) => {
          const order = { ...state.order }
          delete order[workspace]
          return { order, unsynced: true }
        })
        saveToAccount()
      },
    }),
    {
      name: "zadaniomat-nav-order",
      partialize: (state) => ({ order: state.order, unsynced: state.unsynced }),
      // Read after the first render - the server renders the default order
      skipHydration: true,
    }
  )
)

let started = false

// Once per page: reads the order kept on the device, then takes the one saved to
// the account - or saves this device's change made while the server was unreachable
export async function loadNavOrder() {
  if (started) return
  started = true
  await useNavOrderStore.persist.rehydrate()

  if (useNavOrderStore.getState().unsynced) {
    saveToAccount()
    return
  }
  try {
    const res = await fetch("/api/user/nav-order")
    if (!res.ok) return
    const { order } = (await res.json()) as { order: NavOrder | null }
    // Not changed here in the meantime
    if (!useNavOrderStore.getState().unsynced) useNavOrderStore.setState({ order: order ?? {} })
  } catch {
    // Offline - the order kept on the device stays
  }
}

// Items in the user's order; tabs not in it (e.g. added later) keep their place at the end
export function applyNavOrder<T extends { href: string }>(items: T[], hrefs: string[] | undefined): T[] {
  if (!hrefs?.length) return items
  const position = new Map(hrefs.map((href, i) => [href, i]))
  return items
    .map((item, i) => ({ item, key: position.get(item.href) ?? hrefs.length + i }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item)
}
