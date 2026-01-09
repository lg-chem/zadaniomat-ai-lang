import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import dynamic from "next/dynamic"
import { authOptions } from "@/lib/auth"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileHeader } from "@/components/layout/mobile-header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { SessionProvider } from "@/components/providers/session-provider"
import { SWRProvider } from "@/components/providers/swr-provider"
import { DashboardClient } from "@/components/layout/dashboard-client"

// Lazy load heavy components that aren't needed on initial render
const PWAInstallPrompt = dynamic(
  () => import("@/components/pwa-install-prompt").then((mod) => mod.PWAInstallPrompt),
  { ssr: false }
)

const FloatingChat = dynamic(
  () => import("@/components/chat/floating-chat").then((mod) => mod.FloatingChat),
  { ssr: false }
)

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return (
    <SessionProvider>
      <SWRProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <MobileHeader />
          <main className="md:pl-64 pt-16 md:pt-0">
            <div className="p-3 md:p-8 pb-16 md:pb-8">
              <DashboardClient>{children}</DashboardClient>
            </div>
          </main>
          <BottomNav />
          <PWAInstallPrompt />
          <FloatingChat />
        </div>
      </SWRProvider>
    </SessionProvider>
  )
}
