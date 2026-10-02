import type { Editor } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState } from "@tiptap/pm/state"

// Working with text linked to tasks (the taskRef mark). Only types are imported,
// so pages can use this without loading the editor.

export interface TaskRefRange {
  from: number
  to: number
  text: string
}

export function taskIdOf(node: PMNode): string | null {
  const mark = node.marks.find((m) => m.type.name === "taskRef")
  return (mark?.attrs.taskId as string | undefined) || null
}

// Ids of all tasks linked in the text, sorted
export function taskRefIds(doc: PMNode): string[] {
  const ids = new Set<string>()
  doc.descendants((node) => {
    if (!node.isText) return
    const id = taskIdOf(node)
    if (id) ids.add(id)
  })
  return Array.from(ids).sort()
}

// Text to make a task from: the selection, or (with `line`) the whole line with the cursor
export function textForTask(state: EditorState, { line = true }: { line?: boolean } = {}): TaskRefRange | null {
  const { from, to, empty, $from } = state.selection
  if (!empty) {
    const text = state.doc.textBetween(from, to, "\n").trim()
    if (text) return { from, to, text }
  }
  if (line && $from.parent.isTextblock) {
    const start = $from.start()
    const end = $from.end()
    const text = state.doc.textBetween(start, end, "\n").trim()
    if (text) return { from: start, to: end, text }
  }
  return null
}

// Where the text is now - the document may have changed while the task was being created
function locate(doc: PMNode, range: TaskRefRange): { from: number; to: number } | null {
  if (range.to <= doc.content.size && doc.textBetween(range.from, range.to, "\n").trim() === range.text) {
    return range
  }
  const needle = range.text.split("\n")[0]
  let found: { from: number; to: number } | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (!node.isTextblock) return true
    const index = node.textContent.indexOf(needle)
    if (index >= 0) {
      const from = pos + 1 + index
      const to = from + needle.length
      if (doc.textBetween(from, to) === needle) found = { from, to }
    }
    return false
  })
  return found
}

// Links the text to the task. Returns false when the text is gone.
export function addTaskRef(editor: Editor, range: TaskRefRange, taskId: string): boolean {
  if (editor.isDestroyed) return false
  const { state } = editor
  const at = locate(state.doc, range)
  if (!at) return false
  editor.view.dispatch(state.tr.addMark(at.from, at.to, state.schema.marks.taskRef.create({ taskId })))
  return true
}

// Leaves the text, drops the link to the task
export function removeTaskRef(editor: Editor, taskId: string) {
  if (editor.isDestroyed) return
  const { state } = editor
  const type = state.schema.marks.taskRef
  const tr = state.tr
  state.doc.descendants((node, pos) => {
    if (node.isText && taskIdOf(node) === taskId) tr.removeMark(pos, pos + node.nodeSize, type)
  })
  if (tr.docChanged) editor.view.dispatch(tr)
}
