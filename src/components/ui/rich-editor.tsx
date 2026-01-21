"use client"

import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { useEffect } from "react"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Heading2,
  Heading3,
  CheckSquare,
  Undo,
  Redo,
  Quote,
  Code,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RichEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  editable?: boolean
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null

  const addLink = () => {
    const url = window.prompt("URL:")
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    }
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
      <Button
        type="button"
        variant={editor.isActive("bold") ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Pogrubienie (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("italic") ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Kursywa (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("code") ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Kod"
      >
        <Code className="h-4 w-4" />
      </Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        type="button"
        variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Nagłówek H2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Nagłówek H3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        type="button"
        variant={editor.isActive("bulletList") ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Lista punktowana"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("orderedList") ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Lista numerowana"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("taskList") ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Lista zadań"
      >
        <CheckSquare className="h-4 w-4" />
      </Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        type="button"
        variant={editor.isActive("blockquote") ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Cytat"
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("link") ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={addLink}
        title="Dodaj link"
      >
        <LinkIcon className="h-4 w-4" />
      </Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Cofnij (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Ponów (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function RichEditor({
  content,
  onChange,
  placeholder = "Zacznij pisać...",
  className,
  editable = true,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[150px] p-3",
      },
    },
  })

  // Update content when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      {editable && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

// Read-only renderer for HTML content
export function RichContent({ content, className }: { content: string; className?: string }) {
  // Check if content looks like HTML
  const isHtml = content.startsWith("<") || content.includes("<p>") || content.includes("<ul>")

  if (!isHtml) {
    // Plain text - render with line breaks preserved
    return (
      <div className={cn("whitespace-pre-wrap", className)}>
        {content}
      </div>
    )
  }

  // HTML content - render safely
  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

// Helper to strip HTML for AI/embeddings
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}
