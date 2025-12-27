import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Sidebar } from "@/components/layout/sidebar"
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
        <main className="pl-64">
          <div className="p-8">
            <DashboardClient>{children}</DashboardClient>
          </div>
        </main>
      </div>
    </SessionProvider>
  )
}
