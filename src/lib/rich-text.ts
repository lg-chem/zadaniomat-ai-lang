// Helpers for descriptions written in the rich text editor (stored as HTML).
// Older descriptions are plain text from a textarea, so everything here accepts both.

const HTML_TAG = /<\/?(p|h[1-6]|ul|ol|li|blockquote|pre|code|table|tr|td|th|hr|br|div|strong|em|u|s|mark|a|label|input)[\s>/]/i

export function isHtml(value: string | null | undefined): boolean {
  return !!value && HTML_TAG.test(value)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

type LineKind = "bullet" | "ordered" | "task" | "heading" | "text" | "empty"

function classifyLine(line: string): { kind: LineKind; text: string; level?: number; checked?: boolean } {
  let match = line.match(/^\s*[-*•]\s+\[( |x|X)\]\s*(.*)$/)
  if (match) return { kind: "task", text: match[2], checked: match[1].toLowerCase() === "x" }
  match = line.match(/^\s*\[( |x|X)\]\s+(.*)$/)
  if (match) return { kind: "task", text: match[2], checked: match[1].toLowerCase() === "x" }
  match = line.match(/^\s*[-*•]\s+(.*)$/)
  if (match) return { kind: "bullet", text: match[1] }
  match = line.match(/^\s*\d+[.)]\s+(.*)$/)
  if (match) return { kind: "ordered", text: match[1] }
  match = line.match(/^(#{1,3})\s+(.*)$/)
  if (match) return { kind: "heading", text: match[2], level: match[1].length }
  if (!line.trim()) return { kind: "empty", text: "" }
  return { kind: "text", text: line }
}

// Converts a plain text description (e.g. "- zwroty\n- faktury") into editor HTML,
// keeping lists, checkboxes and line breaks the user typed.
export function plainTextToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const html: string[] = []
  let openList: "bullet" | "ordered" | "task" | null = null

  const closeList = () => {
    if (openList === "ordered") html.push("</ol>")
    else if (openList) html.push("</ul>")
    openList = null
  }

  for (const line of lines) {
    const { kind, text: content, level, checked } = classifyLine(line)
    const inner = escapeHtml(content)

    if (kind === "bullet" || kind === "ordered" || kind === "task") {
      if (openList !== kind) {
        closeList()
        html.push(kind === "ordered" ? "<ol>" : kind === "task" ? '<ul data-type="taskList">' : "<ul>")
        openList = kind
      }
      html.push(
        kind === "task"
          ? `<li data-type="taskItem" data-checked="${checked ? "true" : "false"}"><p>${inner}</p></li>`
          : `<li><p>${inner}</p></li>`
      )
      continue
    }

    closeList()
    if (kind === "heading") html.push(`<h${level}>${inner}</h${level}>`)
    else if (kind === "text") html.push(`<p>${inner}</p>`)
    else if (html.length > 0) html.push("<p></p>")
  }
  closeList()

  return html.join("")
}

// Content ready to load into the editor
export function toEditorHtml(value: string | null | undefined): string {
  if (!value) return ""
  return isHtml(value) ? value : plainTextToHtml(value)
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
}

// Plain text version for previews, AI context and search
export function htmlToPlainText(value: string | null | undefined): string {
  if (!value) return ""
  if (!isHtml(value)) return value.trim()

  return value
    // Paragraphs inside list items don't start new lines
    .replace(/(<li[^>]*>)\s*<p[^>]*>/gi, "$1")
    .replace(/<\/p>\s*(<\/li>|<ul|<ol)/gi, "$1")
    .replace(/<li[^>]*data-checked="true"[^>]*>/gi, "☑ ")
    .replace(/<li[^>]*data-checked="false"[^>]*>/gi, "☐ ")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<(ul|ol)[^>]*>\s*(?=[•☐☑])/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|blockquote|pre|tr|div|li)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// "<p></p>" and whitespace-only documents count as no description
export function isEmptyRichText(value: string | null | undefined): boolean {
  if (!value) return true
  if (!isHtml(value)) return !value.trim()
  if (/<(img|hr|table)[\s>/]/i.test(value)) return false
  return !htmlToPlainText(value).replace(/[☐☑•]/g, "").trim()
}

// Value to store: null for an empty editor
export function normalizeRichText(value: string | null | undefined): string | null {
  return isEmptyRichText(value) ? null : (value as string)
}
