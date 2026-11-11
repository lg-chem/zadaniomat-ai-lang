import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type WorkspaceType = 'FRIENDS' | 'WORK' | 'PRIVATE'

interface WorkspaceState {
  workspace: WorkspaceType
  setWorkspace: (workspace: WorkspaceType) => void
}

export const WORKSPACE_COOKIE = 'zadaniomat-workspace'

/** Page a workspace starts on: private - "Dziś", the rest - the plan of the day */
export function workspaceHome(workspace: string | undefined | null): string {
  return workspace === 'PRIVATE' ? '/today' : '/schedule'
}

// The server can't read what the browser keeps for the store - the cookie tells it
// which workspace is open, so the app starts on that workspace's page
function rememberForServer(workspace: WorkspaceType) {
  if (typeof document === 'undefined') return
  document.cookie = `${WORKSPACE_COOKIE}=${workspace}; path=/; max-age=31536000; samesite=lax`
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspace: 'FRIENDS',
      setWorkspace: (workspace) => {
        rememberForServer(workspace)
        set({ workspace })
      },
    }),
    {
      name: 'zadaniomat-workspace',
      // Workspaces picked before the cookie existed get it on the next start
      onRehydrateStorage: () => (state) => {
        if (state) rememberForServer(state.workspace)
      },
    }
  )
)
