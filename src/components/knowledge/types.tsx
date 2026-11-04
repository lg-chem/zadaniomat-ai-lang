import { CheckCircle, FileText, HelpCircle, Layout, List, Wrench } from "lucide-react"
import { htmlToPlainText } from "@/lib/rich-text"

export interface KnowledgeCategory {
  id: string
  name: string
  color: string
  icon?: string | null
  description?: string | null
  linkedCategoryId?: string | null
  parentId?: string | null
  children?: KnowledgeCategory[]
  _count: {
    entries: number
  }
}

export type KnowledgeEntryType = "ARTICLE" | "SOP" | "HOWTO" | "FAQ" | "CHECKLIST" | "TEMPLATE"
export type KnowledgeVisibility = "PRIVATE" | "TEAM"

export interface KnowledgeStep {
  id?: string
  order: number
  title: string
  description?: string | null
  estimatedTime?: number | null
  assignedRole?: string | null
}

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  type: KnowledgeEntryType
  isImportant: boolean
  visibility: KnowledgeVisibility
  tags: string[]
  currentVersion?: number
  createdAt: string
  updatedAt: string
  category: KnowledgeCategory
  userId: string
  user?: {
    id: string
    name: string | null
  }
  steps?: KnowledgeStep[]
}

// What the editor keeps and saves
export interface EntryDraft {
  title: string
  content: string
  categoryId: string
  type: KnowledgeEntryType
  visibility: KnowledgeVisibility
  isImportant: boolean
  tags: string[]
  steps: KnowledgeStep[]
}

export function draftFromEntry(entry: KnowledgeEntry): EntryDraft {
  return {
    title: entry.title,
    content: entry.content,
    categoryId: entry.category.id,
    type: entry.type || "ARTICLE",
    visibility: entry.visibility || "PRIVATE",
    isImportant: entry.isImportant,
    tags: entry.tags || [],
    steps: entry.steps || [],
  }
}

export const ENTRY_TYPE_CONFIG: Record<KnowledgeEntryType, { label: string; description: string }> = {
  ARTICLE: { label: "Artykuł", description: "Standardowy wpis wiedzy" },
  SOP: { label: "Procedura (SOP)", description: "Proces z krokami do wykonania" },
  HOWTO: { label: "Instrukcja", description: "Jak coś zrobić - poradnik" },
  FAQ: { label: "FAQ", description: "Pytanie i odpowiedź" },
  CHECKLIST: { label: "Checklist", description: "Lista do odhaczenia" },
  TEMPLATE: { label: "Szablon", description: "Szablon do kopiowania" },
}

export const ENTRY_TYPES = Object.keys(ENTRY_TYPE_CONFIG) as KnowledgeEntryType[]

export function EntryTypeIcon({ type, className }: { type: KnowledgeEntryType; className?: string }) {
  switch (type) {
    case "SOP":
      return <List className={className} />
    case "HOWTO":
      return <Wrench className={className} />
    case "FAQ":
      return <HelpCircle className={className} />
    case "CHECKLIST":
      return <CheckCircle className={className} />
    case "TEMPLATE":
      return <Layout className={className} />
    default:
      return <FileText className={className} />
  }
}

// Title shown when the entry has none - the first line of the text
export function entryDisplayTitle(entry: { title: string; content: string }): string {
  if (entry.title.trim()) return entry.title
  const firstLine = htmlToPlainText(entry.content).split("\n").find((line) => line.trim())
  return firstLine?.replace(/^[•☐☑]\s*/, "").slice(0, 120) || "Bez tytułu"
}
