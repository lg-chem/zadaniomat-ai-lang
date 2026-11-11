import { create } from "zustand"
import { persist } from "zustand/middleware"

interface PlanViewState {
  /** The plan of the day also shows the other workspace (work in private, private in work) */
  showOtherWorkspace: boolean
  setShowOtherWorkspace: (show: boolean) => void
}

// Kept on the device - the choice stays for the next visits
export const usePlanViewStore = create<PlanViewState>()(
  persist(
    (set) => ({
      showOtherWorkspace: false,
      setShowOtherWorkspace: (showOtherWorkspace) => set({ showOtherWorkspace }),
    }),
    { name: "zadaniomat-plan-view" }
  )
)
