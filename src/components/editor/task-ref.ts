import { Mark, mergeAttributes, type Editor } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { taskIdOf } from "./task-ref-text"

// A piece of text turned into a task. The HTML keeps only the task id
// (<span data-task-id="…">); the status is read live, so the text is crossed out
// as soon as the task is done, wherever that happened.

export interface TaskRefInfo {
  id: string
  title: string
  status: string
  scheduledDate: string | null
  scheduledTime: string | null
}

// Task id → its data; null = deleted or not ours
export type TaskRefTasks = Record<string, TaskRefInfo | null>

type RefState = "open" | "done" | "cancelled" | "missing" | "unknown"

// Fired by the round icon in front of the text; TaskRefsLayer shows the task card
export const TASK_REF_OPEN_EVENT = "task-ref-open"

export const taskRefKey = new PluginKey<{ tasks: TaskRefTasks; decorations: DecorationSet }>("taskRef")

const ICONS: Record<RefState, string> = {
  open: '<circle cx="12" cy="12" r="9"/>',
  unknown: '<circle cx="12" cy="12" r="9"/>',
  done: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.15"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  cancelled: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  missing: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>',
}

const STATE_LABELS: Record<RefState, string> = {
  open: "do zrobienia",
  unknown: "",
  done: "zrobione",
  cancelled: "anulowane",
  missing: "usunięte",
}

function refState(tasks: TaskRefTasks, id: string): RefState {
  if (!(id in tasks)) return "unknown"
  const task = tasks[id]
  if (!task) return "missing"
  if (task.status === "COMPLETED") return "done"
  if (task.status === "CANCELLED") return "cancelled"
  return "open"
}

function checkWidget(taskId: string, state: RefState, title: string | undefined) {
  return () => {
    const label = ["Zadanie", title && `„${title}”`, STATE_LABELS[state] && `(${STATE_LABELS[state]})`]
      .filter(Boolean)
      .join(" ")
    const el = document.createElement("span")
    el.className = `task-ref-check task-ref-check-${state}`
    el.contentEditable = "false"
    el.setAttribute("role", "button")
    el.setAttribute("data-task-ref-open", taskId)
    el.setAttribute("aria-label", label)
    el.title = label
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[state]}</svg>`
    // Don't move the cursor or open the keyboard, just show the card
    el.addEventListener("mousedown", (e) => e.preventDefault())
    el.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.dispatchEvent(new CustomEvent(TASK_REF_OPEN_EVENT, { bubbles: true, detail: { taskId } }))
    })
    return el
  }
}

function buildDecorations(doc: PMNode, tasks: TaskRefTasks): DecorationSet {
  const decorations: Decoration[] = []
  const withIcon = new Set<string>()
  let run: { id: string; from: number; to: number } | null = null

  const flush = () => {
    if (!run) return
    const state = refState(tasks, run.id)
    decorations.push(Decoration.inline(run.from, run.to, { class: `task-ref-text task-ref-${state}` }))
    // One icon per task, in front of its first piece of text
    if (!withIcon.has(run.id)) {
      withIcon.add(run.id)
      const title = tasks[run.id]?.title
      decorations.push(
        Decoration.widget(run.from, checkWidget(run.id, state, title), {
          side: -1,
          marks: [],
          ignoreSelection: true,
          stopEvent: () => true,
          key: `task-ref:${run.id}:${state}:${title ?? ""}`,
        })
      )
    }
    run = null
  }

  doc.descendants((node, pos) => {
    if (!node.isText) return
    const id = taskIdOf(node)
    if (id && run?.id === id && run.to === pos) {
      run.to = pos + node.nodeSize
      return
    }
    flush()
    if (id) run = { id, from: pos, to: pos + node.nodeSize }
  })
  flush()

  return DecorationSet.create(doc, decorations)
}

export const TaskRef = Mark.create({
  name: "taskRef",
  // Typing right after the text doesn't make the task longer
  inclusive: false,

  addAttributes() {
    return {
      taskId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-task-id"),
        renderHTML: (attributes) => (attributes.taskId ? { "data-task-id": attributes.taskId } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-task-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "task-ref" }), 0]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: taskRefKey,
        state: {
          init: (_, state) => ({ tasks: {}, decorations: buildDecorations(state.doc, {}) }),
          apply: (tr, value, _old, state) => {
            const tasks = tr.getMeta(taskRefKey) as TaskRefTasks | undefined
            if (tasks) return { tasks, decorations: buildDecorations(state.doc, tasks) }
            if (tr.docChanged) return { tasks: value.tasks, decorations: buildDecorations(state.doc, value.tasks) }
            return value
          },
        },
        props: {
          decorations: (state) => taskRefKey.getState(state)?.decorations,
        },
      }),
    ]
  },
})

// Statuses fetched from the server; changes only the look, not the document
export function setTaskRefTasks(editor: Editor, tasks: TaskRefTasks) {
  if (editor.isDestroyed) return
  editor.view.dispatch(editor.state.tr.setMeta(taskRefKey, tasks).setMeta("addToHistory", false))
}

export function getTaskRefTask(editor: Editor, taskId: string): TaskRefInfo | null | undefined {
  return taskRefKey.getState(editor.state)?.tasks[taskId]
}
