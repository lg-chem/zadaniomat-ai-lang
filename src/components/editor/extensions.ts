import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Highlight from "@tiptap/extension-highlight"
import { TableKit } from "@tiptap/extension-table"

interface EditorExtensionOptions {
  placeholder?: string
  editable?: boolean
}

// One schema for every place that edits or shows a description,
// so a document written in full screen looks the same everywhere.
export function createEditorExtensions({ placeholder = "", editable = true }: EditorExtensionOptions = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: !editable,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
      },
    }),
    Placeholder.configure({ placeholder }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    TableKit.configure({ table: { resizable: false } }),
  ]
}
