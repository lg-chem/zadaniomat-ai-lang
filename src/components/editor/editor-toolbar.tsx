"use client"

import { useState, type ReactNode } from "react"
import { useEditorState, type Editor } from "@tiptap/react"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  ListChecks,
  Link as LinkIcon,
  Quote,
  Code2,
  Minus,
  Table as TableIcon,
  Undo2,
  Redo2,
  RemoveFormatting,
  Heading2,
  ChevronDown,
  Maximize2,
  LayoutTemplate,
  ListPlus,
  IndentIncrease,
  IndentDecrease,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { DOCUMENT_TEMPLATES } from "./templates"
import { currentOrderedListStyle, setOrderedListStyle, type OrderedListStyle } from "./list-style"

const ORDERED_STYLES: { id: OrderedListStyle; label: string; sample: string }[] = [
  { id: "1", label: "Numery", sample: "1. 2. 3." },
  { id: "a", label: "Litery", sample: "a. b. c." },
  { id: "i", label: "Rzymskie", sample: "i. ii. iii." },
]

const TEXT_STYLES = [
  { id: "paragraph", label: "Zwykły tekst", className: "text-sm" },
  { id: "h1", label: "Tytuł", className: "text-xl font-bold" },
  { id: "h2", label: "Nagłówek", className: "text-lg font-semibold" },
  { id: "h3", label: "Podnagłówek", className: "text-base font-semibold" },
] as const

type TextStyleId = (typeof TEXT_STYLES)[number]["id"]

// lg - finger-sized, for the phone toolbar above the keyboard
type ToolbarSize = "sm" | "md" | "lg"
const SIZE_CLASS: Record<ToolbarSize, string> = { sm: "h-7 w-7", md: "h-8 w-8", lg: "h-10 w-10" }

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
  size = "md",
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: ReactNode
  size?: ToolbarSize
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text selection in the editor while clicking
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none",
        SIZE_CLASS[size],
        active ? "bg-primary/10 text-primary dark:bg-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />
}

// Moves the list item with the cursor in (sub-point of the item above) or out
function IndentButtons({
  editor,
  canSink,
  canLift,
  size,
  iconClassName,
}: {
  editor: Editor
  canSink: boolean
  canLift: boolean
  size: ToolbarSize
  iconClassName: string
}) {
  const sink = () => {
    const chain = editor.chain().focus()
    if (editor.can().sinkListItem("taskItem")) chain.sinkListItem("taskItem").run()
    else chain.sinkListItem("listItem").run()
  }
  const lift = () => {
    const chain = editor.chain().focus()
    if (editor.can().liftListItem("taskItem")) chain.liftListItem("taskItem").run()
    else chain.liftListItem("listItem").run()
  }
  return (
    <>
      <ToolbarButton size={size} title="Zmniejsz wcięcie (Shift+Tab)" disabled={!canLift} onClick={lift}>
        <IndentDecrease className={iconClassName} />
      </ToolbarButton>
      <ToolbarButton size={size} title="Podpunkt - wcięcie (Tab)" disabled={!canSink} onClick={sink}>
        <IndentIncrease className={iconClassName} />
      </ToolbarButton>
    </>
  )
}

// Task from the selected text, or from the line with the cursor
function CreateTaskButton({ onClick, size }: { onClick: () => void; size: ToolbarSize }) {
  return (
    <button
      type="button"
      title="Zrób zadanie z zaznaczonego tekstu (albo z linijki z kursorem)"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
        size === "sm" ? "h-7 px-1.5 text-xs" : size === "lg" ? "h-10 px-3 text-sm" : "h-8 px-2 text-sm"
      )}
    >
      <ListPlus className={size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      Zadanie
    </button>
  )
}

function LinkButton({ editor, active, size }: { editor: Editor; active: boolean; size: ToolbarSize }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")

  const apply = () => {
    const href = url.trim()
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else if (editor.state.selection.empty && !editor.isActive("link")) {
      editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    }
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl((editor.getAttributes("link").href as string) || "")
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Link"
          aria-label="Link"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md transition-colors",
            SIZE_CLASS[size],
            active ? "bg-primary/10 text-primary dark:bg-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <LinkIcon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-1rem))] p-3" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                apply()
              }
            }}
            placeholder="Wklej adres, np. https://…"
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" className="h-8" onClick={apply}>
            OK
          </Button>
        </div>
        {active && (
          <button
            type="button"
            className="mt-2 text-xs text-destructive hover:underline"
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
              setOpen(false)
            }}
          >
            Usuń link
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface EditorToolbarProps {
  editor: Editor | null
  // mobile - one row of finger-sized buttons, scrolled sideways (kept above the keyboard)
  variant?: "full" | "compact" | "mobile"
  onExpand?: () => void
  // Shows "Zadanie": a task from the selection, linked in the text
  onCreateTask?: () => void
  className?: string
}

export function EditorToolbar({ editor, variant = "full", onExpand, onCreateTask, className }: EditorToolbarProps) {
  // Reads the editor from props: the snapshot keeps `null` until the first transaction
  // after the editor is created, which would hide the toolbar until the user types
  const state = useEditorState({
    editor,
    selector: () => {
      const e = editor
      if (!e || e.isDestroyed) return null
      const textStyle: TextStyleId = e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "paragraph"
      return {
        textStyle,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        highlight: e.isActive("highlight"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        taskList: e.isActive("taskList"),
        blockquote: e.isActive("blockquote"),
        codeBlock: e.isActive("codeBlock"),
        link: e.isActive("link"),
        table: e.isActive("table"),
        inList: e.isActive("listItem") || e.isActive("taskItem"),
        canSink: e.can().sinkListItem("listItem") || e.can().sinkListItem("taskItem"),
        canLift: e.can().liftListItem("listItem") || e.can().liftListItem("taskItem"),
        orderedStyle: e.isActive("orderedList") ? currentOrderedListStyle(e) : null,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      }
    },
  })

  if (!editor || !state) return null

  const chain = () => editor.chain().focus()

  const setTextStyle = (id: TextStyleId) => {
    if (id === "paragraph") chain().setParagraph().run()
    else chain().setHeading({ level: Number(id.slice(1)) as 1 | 2 | 3 }).run()
  }

  if (variant === "mobile") {
    const icon = "h-5 w-5"
    return (
      <div
        className={cn(
          "flex items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className
        )}
      >
        <ToolbarButton size="lg" title="Lista z checkboxami" active={state.taskList} onClick={() => chain().toggleTaskList().run()}>
          <ListChecks className={icon} />
        </ToolbarButton>
        <ToolbarButton size="lg" title="Lista punktowana" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
          <List className={icon} />
        </ToolbarButton>
        <ToolbarButton size="lg" title="Lista numerowana" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered className={icon} />
        </ToolbarButton>
        {state.inList && (
          <IndentButtons editor={editor} canSink={state.canSink} canLift={state.canLift} size="lg" iconClassName={icon} />
        )}
        <ToolbarButton size="lg" title="Nagłówek" active={state.textStyle === "h2"} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
          <Heading2 className={icon} />
        </ToolbarButton>
        <Divider />
        <ToolbarButton size="lg" title="Pogrubienie" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <Bold className={icon} />
        </ToolbarButton>
        <ToolbarButton size="lg" title="Kursywa" active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic className={icon} />
        </ToolbarButton>
        <ToolbarButton size="lg" title="Zakreślacz" active={state.highlight} onClick={() => chain().toggleHighlight().run()}>
          <Highlighter className={icon} />
        </ToolbarButton>
        <LinkButton editor={editor} active={state.link} size="lg" />
        <Divider />
        <ToolbarButton size="lg" title="Cofnij" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
          <Undo2 className={icon} />
        </ToolbarButton>
        <ToolbarButton size="lg" title="Ponów" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
          <Redo2 className={icon} />
        </ToolbarButton>
        {onCreateTask && (
          <>
            <Divider />
            <CreateTaskButton size="lg" onClick={onCreateTask} />
          </>
        )}
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-0.5 flex-wrap", className)}>
        <ToolbarButton size="sm" title="Pogrubienie (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton size="sm" title="Kursywa (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton size="sm" title="Zakreślacz" active={state.highlight} onClick={() => chain().toggleHighlight().run()}>
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton size="sm" title="Nagłówek" active={state.textStyle === "h2"} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton size="sm" title="Lista punktowana" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton size="sm" title="Lista numerowana" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton size="sm" title="Lista z checkboxami" active={state.taskList} onClick={() => chain().toggleTaskList().run()}>
          <ListChecks className="h-3.5 w-3.5" />
        </ToolbarButton>
        {state.inList && (
          <IndentButtons
            editor={editor}
            canSink={state.canSink}
            canLift={state.canLift}
            size="sm"
            iconClassName="h-3.5 w-3.5"
          />
        )}
        <LinkButton editor={editor} active={state.link} size="sm" />
        {onCreateTask && (
          <>
            <Divider />
            <CreateTaskButton size="sm" onClick={onCreateTask} />
          </>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Otwórz opis jako dokument na pełnym ekranie"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Pełny ekran
          </button>
        )}
      </div>
    )
  }

  const currentStyle = TEXT_STYLES.find((s) => s.id === state.textStyle) ?? TEXT_STYLES[0]

  return (
    <div className={cn("flex items-center gap-0.5 flex-wrap", className)}>
      <ToolbarButton title="Cofnij (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Ponów (Ctrl+Y)" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            className="inline-flex h-8 w-36 items-center justify-between rounded-md px-2 text-sm hover:bg-muted"
          >
            <span className="truncate">{currentStyle.label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
          {TEXT_STYLES.map((style) => (
            <DropdownMenuItem key={style.id} onSelect={() => setTextStyle(style.id)}>
              <span className={style.className}>{style.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />

      <ToolbarButton title="Pogrubienie (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Kursywa (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Podkreślenie (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Przekreślenie" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Zakreślacz" active={state.highlight} onClick={() => chain().toggleHighlight().run()}>
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>
      <LinkButton editor={editor} active={state.link} size="md" />
      <Divider />

      <ToolbarButton title="Lista punktowana" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Lista numerowana" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Rodzaj numeracji: 1. 2. 3. / a. b. c. / i. ii. iii."
            aria-label="Rodzaj numeracji"
            onMouseDown={(e) => e.preventDefault()}
            className="-ml-0.5 inline-flex h-8 w-4 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Numeracja listy</DropdownMenuLabel>
          {ORDERED_STYLES.map((style) => (
            <DropdownMenuItem key={style.id} onSelect={() => setOrderedListStyle(editor, style.id)}>
              <span className={cn("w-20 font-mono text-xs", state.orderedStyle === style.id && "font-semibold text-primary")}>
                {style.sample}
              </span>
              {style.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton title="Lista z checkboxami" active={state.taskList} onClick={() => chain().toggleTaskList().run()}>
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>
      <IndentButtons editor={editor} canSink={state.canSink} canLift={state.canLift} size="md" iconClassName="h-4 w-4" />
      <Divider />

      <ToolbarButton title="Cytat / wyróżnienie" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Blok kodu" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <Code2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Linia pozioma" onClick={() => chain().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Tabela"
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "inline-flex h-8 items-center gap-0.5 rounded-md px-1.5 transition-colors",
              state.table ? "bg-primary/10 text-primary dark:bg-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <TableIcon className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            Wstaw tabelę 3 × 3
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 4, cols: 2, withHeaderRow: true }).run()}>
            Wstaw tabelę 2 kolumny
          </DropdownMenuItem>
          {state.table && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => chain().addRowAfter().run()}>Dodaj wiersz poniżej</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().addColumnAfter().run()}>Dodaj kolumnę po prawej</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().deleteRow().run()}>Usuń wiersz</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().deleteColumn().run()}>Usuń kolumnę</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => chain().deleteTable().run()}>
                Usuń tabelę
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />

      <ToolbarButton title="Wyczyść formatowanie" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LayoutTemplate className="h-4 w-4" />
            <span className="hidden sm:inline">Szablon</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Wstawia się w miejscu kursora
          </DropdownMenuLabel>
          {DOCUMENT_TEMPLATES.map((template) => (
            <DropdownMenuItem
              key={template.id}
              className="flex-col items-start gap-0"
              onSelect={() => {
                if (editor.isEmpty) editor.chain().focus().setContent(template.html).run()
                else chain().insertContent(template.html).run()
              }}
            >
              <span className="font-medium">{template.label}</span>
              <span className="text-xs text-muted-foreground">{template.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {onCreateTask && (
        <>
          <Divider />
          <CreateTaskButton size="md" onClick={onCreateTask} />
        </>
      )}
    </div>
  )
}
