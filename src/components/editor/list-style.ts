import type { Editor } from "@tiptap/react"

// Numbering of numbered lists: 1. 2. 3. / a. b. c. / i. ii. iii.
// Kept apart from the NestedLists extension so the toolbar stays light.

export type OrderedListStyle = "1" | "a" | "i"

// Sets the numbering of the numbered list with the cursor (makes one if needed)
export function setOrderedListStyle(editor: Editor, style: OrderedListStyle) {
  const chain = editor.chain().focus()
  if (!editor.isActive("orderedList")) chain.toggleOrderedList()
  chain
    .command(({ tr }) => {
      for (let depth = tr.selection.$from.depth; depth > 0; depth--) {
        const node = tr.selection.$from.node(depth)
        if (node.type.name === "orderedList") {
          tr.setNodeMarkup(tr.selection.$from.before(depth), undefined, { ...node.attrs, type: style })
          return true
        }
      }
      return false
    })
    .run()
}

// Numbering of the numbered list with the cursor, as shown (nested lists default to a, then i)
export function currentOrderedListStyle(editor: Editor): OrderedListStyle | null {
  const { $from } = editor.state.selection
  let nesting = 0
  let style: OrderedListStyle | null = null
  let found = false
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== "orderedList") continue
    if (!found) {
      found = true
      style = (node.attrs.type as OrderedListStyle | null) ?? null
    } else {
      nesting++
    }
  }
  if (!found) return null
  return style ?? (["1", "a", "i"] as const)[Math.min(nesting, 2)]
}
