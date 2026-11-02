import { useEffect, useState } from "react"

interface VisualViewportBox {
  height: number
  offsetTop: number
}

// The part of the screen left above the phone's keyboard. A full screen view sized
// to it keeps its bottom bar (e.g. formatting buttons) right above the keyboard.
export function useVisualViewport(enabled = true): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!enabled || !viewport) return
    const update = () => setBox({ height: viewport.height, offsetTop: viewport.offsetTop })
    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
    }
  }, [enabled])

  return enabled ? box : null
}
