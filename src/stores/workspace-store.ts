import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type WorkspaceType = 'FRIENDS' | 'WORK' | 'PRIVATE'

interface WorkspaceState {
  workspace: WorkspaceType
  setWorkspace: (workspace: WorkspaceType) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspace: 'FRIENDS',
      setWorkspace: (workspace) => set({ workspace }),
    }),
    {
      name: 'zadaniomat-workspace',
    }
  )
)
