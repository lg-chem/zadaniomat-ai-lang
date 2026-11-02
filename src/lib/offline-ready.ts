"use client"

// Run when the app is open logged in with internet: the service worker keeps the
// Notes page and every build file the app has loaded, so Notes open offline later
// (also when the worker was installed on the login page, before logging in).
// The editor is normally loaded only when a note is opened - load it ahead too.
export function prepareOfflineUse() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !navigator.onLine) return () => {}

  const run = async () => {
    const registration = await navigator.serviceWorker.ready
    const { preloadEditor } = await import("@/components/editor/lazy")
    await preloadEditor().catch(() => {})
    const urls = [
      ...performance.getEntriesByType("resource").map((entry) => entry.name),
      ...Array.from(document.scripts, (script) => script.src),
    ].filter((url) => url.includes("/_next/static/"))
    registration.active?.postMessage({ type: "prepare-offline", urls: [...new Set(urls)] })
  }

  // After the page has loaded - doesn't slow it down
  const timer = setTimeout(() => {
    run().catch((error) => console.error("Could not prepare offline use:", error))
  }, 3000)
  return () => clearTimeout(timer)
}
