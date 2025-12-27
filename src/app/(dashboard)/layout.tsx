import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileHeader } from "@/components/layout/mobile-header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { SessionProvider } from "@/components/providers/session-provider"
import { DashboardClient } from "@/components/layout/dashboard-client"

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
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileHeader />
        <main className="md:pl-64 pt-16 md:pt-0">
          <div className="p-3 md:p-8 pb-16 md:pb-8">
            <DashboardClient>{children}</DashboardClient>
          </div>
        </main>
        <BottomNav />
      </div>
    </SessionProvider>
  )
}
