import { getServerSession } from "next-auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { LandingPage } from "@/components/landing/landing-page"
import { WORKSPACE_COOKIE, workspaceHome } from "@/stores/workspace-store"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session) {
    // The app opens on the page of the workspace used last: private - "Dziś"
    redirect(workspaceHome(cookies().get(WORKSPACE_COOKIE)?.value))
  }

  return <LandingPage />
}
