import { useSyncExternalStore } from "react"

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

// Whether the device has a connection (true while rendering on the server)
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
