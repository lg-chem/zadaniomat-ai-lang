import { redirect } from "next/navigation"

// Sprints are planned inside the quarter view on the goals page
export default function SprintsPage() {
  redirect("/goals")
}
