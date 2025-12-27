import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type WorkspaceType = 'WORK' | 'PRIVATE'

interface WorkspaceState {
  workspace: WorkspaceType
  setWorkspace: (workspace: WorkspaceType) => void
  toggleWorkspace: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspace: 'WORK',
      setWorkspace: (workspace) => set({ workspace }),
      toggleWorkspace: () =>
        set((state) => ({
          workspace: state.workspace === 'WORK' ? 'PRIVATE' : 'WORK',
        })),
    }),
    {
      name: 'zadaniomat-workspace',
    }
  )
)
