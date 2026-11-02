import { useSyncExternalStore } from "react"

// Whether a CSS media query matches (false while rendering on the server)
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

// Phone / tablet layout - below Tailwind's lg breakpoint
export const useIsCompactScreen = () => useMediaQuery("(max-width: 1023px)")

// A finger, not a mouse - e.g. Enter makes a new line instead of saving
export const useIsTouch = () => useMediaQuery("(pointer: coarse)")
