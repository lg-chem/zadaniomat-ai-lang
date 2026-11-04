import { Extension, InputRule } from "@tiptap/core"
import type { Node as PmNode, ResolvedPos } from "@tiptap/pm/model"
import { EditorState, Selection, type Command, type Transaction } from "@tiptap/pm/state"
import { canJoin } from "@tiptap/pm/transform"
import { sinkListItem, splitListItem } from "@tiptap/pm/schema-list"
import type { OrderedListStyle } from "./list-style"

// Sub-points inside lists, the way people type them:
// - "- " (or "* ") at the start of a list item → bullets under the item above
// - "a. " → a, b, c under the item above; "i. " → i, ii, iii; "1. " → 1, 2, 3
// - the same right after Shift+Enter in an item → the rest becomes a sub-point
// Tab / Shift+Tab (and the toolbar buttons) move items in and out.
// Nested numbered lists are shown as 1. → a. → i. (see .rich-text in globals.css).

type ListTarget = { list: "bulletList" } | { list: "orderedList"; style: OrderedListStyle }

const MARKER = "([-+*•]|[ai][.)]|\\d{1,3}[.)])"

function targetFor(marker: string): ListTarget {
  if (/^[-+*•]$/.test(marker)) return { list: "bulletList" }
  if (/^a/.test(marker)) return { list: "orderedList", style: "a" }
  if (/^i/.test(marker)) return { list: "orderedList", style: "i" }
  return { list: "orderedList", style: "1" }
}

// Depth of the list item (bullets / numbers, not checkboxes) holding the position's paragraph
function listItemDepth($pos: ResolvedPos): number | null {
  const depth = $pos.depth - 1
  if (depth < 1) return null
  return $pos.node(depth).type.name === "listItem" ? depth : null
}

// Runs a ProseMirror command on the transaction an input rule is building.
// (TipTap's `commands` there keep the cursor from before the rule's own changes.)
function runOn(tr: Transaction, command: Command): boolean {
  const state = EditorState.create({ doc: tr.doc, selection: tr.selection })
  let applied = false
  command(state, (inner) => {
    inner.steps.forEach((step) => tr.step(step))
    tr.setSelection(Selection.fromJSON(tr.doc, inner.selection.toJSON()))
    applied = true
  })
  return applied
}

// The list right around the cursor, e.g. the new sub-list
function closestList($pos: ResolvedPos): { node: PmNode; pos: number } | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (node.type.name === "bulletList" || node.type.name === "orderedList") {
      return { node, pos: $pos.before(depth) }
    }
  }
  return null
}

function retypeList(tr: Transaction, target: ListTarget) {
  const list = closestList(tr.selection.$from)
  if (!list) return
  const type = tr.doc.type.schema.nodes[target.list]
  if (!type) return
  if (target.list === "bulletList") {
    if (list.node.type !== type) tr.setNodeMarkup(list.pos, type)
  } else if (list.node.type !== type || list.node.attrs.type !== target.style) {
    const start = list.node.type === type ? ((list.node.attrs.start as number) ?? 1) : 1
    tr.setNodeMarkup(list.pos, type, { start, type: target.style })
  }

  // Right after a sub-list of the same kind (e.g. bullets made earlier) - one list, not two
  const retyped = tr.doc.nodeAt(list.pos)
  const before = tr.doc.resolve(list.pos).nodeBefore
  if (
    retyped &&
    before &&
    before.type === retyped.type &&
    before.attrs.type === retyped.attrs.type &&
    canJoin(tr.doc, list.pos)
  ) {
    tr.join(list.pos)
  }
}

export const NestedLists = Extension.create({
  name: "nestedLists",
  // Before the built-in list rules, which can't start a list inside a list item
  priority: 1000,

  addInputRules() {
    return [
      // Marker typed at the start of a list item
      new InputRule({
        find: new RegExp(`^\\s*${MARKER}\\s$`),
        handler: ({ state, range, match }) => {
          const $from = state.doc.resolve(range.from)
          const itemDepth = listItemDepth($from)
          if (itemDepth === null || $from.index(itemDepth) !== 0) return null

          const itemType = state.schema.nodes.listItem
          const isFirstItem = $from.index(itemDepth - 1) === 0
          if (!isFirstItem && !sinkListItem(itemType)(EditorState.create({ doc: state.doc, selection: state.selection }))) {
            return null
          }

          const tr = state.tr
          tr.delete(range.from, range.to)
          // The first item has nothing above it - the whole list changes instead
          if (!isFirstItem) runOn(tr, sinkListItem(itemType))
          retypeList(tr, targetFor(match[1]))
        },
      }),
      // Marker typed right after Shift+Enter inside an item: the rest becomes a sub-point
      new InputRule({
        find: new RegExp(`\\n${MARKER}\\s$`),
        handler: ({ state, range, match }) => {
          const $from = state.doc.resolve(range.from)
          const itemDepth = listItemDepth($from)
          if (itemDepth === null || state.doc.nodeAt(range.from)?.type.name !== "hardBreak") return null
          // Nothing before the line break - splitting would leave the list
          if (range.from === $from.start()) return null

          const itemType = state.schema.nodes.listItem
          const tr = state.tr
          tr.delete(range.from, range.to)
          if (!runOn(tr, splitListItem(itemType))) return null
          runOn(tr, sinkListItem(itemType))
          retypeList(tr, targetFor(match[1]))
        },
      }),
    ]
  },
})
