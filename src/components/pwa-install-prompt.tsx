"use client"

import { useState, useEffect } from "react"
import { Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    setIsIOS(isIOSDevice)

    // Check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    if (isStandalone) {
      return
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Check if user dismissed before
      const dismissed = localStorage.getItem("pwa-install-dismissed")
      if (!dismissed) {
        setShowPrompt(true)
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // For iOS, show prompt after a delay if not dismissed
    if (isIOSDevice) {
      const dismissed = localStorage.getItem("pwa-install-dismissed")
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000)
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return
    }

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("pwa-install-dismissed", "true")
  }

  if (!showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Zainstaluj Zadaniomat</h3>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-1">
              Kliknij <span className="font-medium">Udostępnij</span> → <span className="font-medium">Dodaj do ekranu początkowego</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Zainstaluj aplikację na swoim urządzeniu dla szybszego dostępu
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {!isIOS && (
              <Button size="sm" onClick={handleInstall}>
                Zainstaluj
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Nie teraz
            </Button>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 -mr-2 -mt-2"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
