"use client"

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react"
import { mutate } from "swr"
import { format, formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"
import ReactMarkdown from "react-markdown"
import {
  Send,
  Bot,
  User,
  Target,
  CalendarDays,
  Plus,
  Loader2,
  Sparkles,
  BookOpen,
  Check,
  AlertTriangle,
  MessageSquare,
  History,
  Settings,
  Trash2,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type ChatMode = "daily_tasks" | "period_goals" | "sprint_goals" | "general"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  data?: GoalProposal[] | TaskProposal[]
  dataType?: "goals" | "tasks"
  isTyping?: boolean
}

// Typing effect hook
function useTypingEffect(text: string, speed: number = 15, enabled: boolean = true) {
  const [displayText, setDisplayText] = useState("")
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setDisplayText(text)
      setIsComplete(true)
      return
    }

    setDisplayText("")
    setIsComplete(false)

    if (!text) return

    let index = 0
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1))
        index++
      } else {
        setIsComplete(true)
        clearInterval(timer)
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed, enabled])

  return { displayText, isComplete }
}

// Typing message component with markdown
function TypingMessage({ content, isNew }: { content: string; isNew: boolean }) {
  const { displayText, isComplete } = useTypingEffect(content, 10, isNew)

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-primary pl-3 italic my-2">{children}</blockquote>,
        }}
      >
        {displayText}
      </ReactMarkdown>
      {!isComplete && <span className="animate-pulse">▊</span>}
    </div>
  )
}

interface GoalProposal {
  title: string
  description?: string
  targetValue?: number
  unit?: string
  category?: string | null
}

interface TaskProposal {
  title: string
  category?: string | null
  plannedMinutes?: number
}

interface Category {
  id: string
  name: string
  color: string
  isStrategic: boolean
}

interface Sprint {
  id: string
  name: string
}

interface Period {
  id: string
  name: string
}

interface KnowledgeCategory {
  id: string
  name: string
  color: string
}

interface Conversation {
  id: string
  type: string
  summary: string
  messagesCount: number
  createdAt: string
  updatedAt: string
}

const MODE_CONFIG: Record<ChatMode, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  general: {
    label: "Ogólny",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Porozmawiaj o czymkolwiek",
    color: "bg-slate-500",
  },
  daily_tasks: {
    label: "Zadania",
    icon: <CalendarDays className="h-4 w-4" />,
    description: "Zaplanuj zadania na dziś",
    color: "bg-blue-500",
  },
  sprint_goals: {
    label: "Sprint",
    icon: <Target className="h-4 w-4" />,
    description: "Cele na sprint (2 tyg)",
    color: "bg-purple-500",
  },
  period_goals: {
    label: "Okres",
    icon: <Target className="h-4 w-4" />,
    description: "Cele na okres (3 mies)",
    color: "bg-orange-500",
  },
}

const MODE_TO_API_TYPE: Record<ChatMode, string> = {
  daily_tasks: "PLANNING",
  period_goals: "PLANNING",
  sprint_goals: "PLANNING",
  general: "GENERAL",
}

export default function AIPage() {
  const [mode, setMode] = useState<ChatMode>("general")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [lastAssistantIndex, setLastAssistantIndex] = useState<number>(-1)

  // Conversation history
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [chatInstructions, setChatInstructions] = useState<Record<string, string>>({})
  const [systemPrompts, setSystemPrompts] = useState<Record<string, string>>({})
  const [metaPrompt, setMetaPrompt] = useState("")
  const [companyInfo, setCompanyInfo] = useState("")
  const [savingSettings, setSavingSettings] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Add goal dialog
  const [addingGoal, setAddingGoal] = useState<GoalProposal | null>(null)
  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    targetValue: "",
    unit: "",
    categoryId: "",
    sprintId: "",
    periodId: "",
  })

  // Add task dialog
  const [addingTask, setAddingTask] = useState<TaskProposal | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: "",
    categoryId: "",
    plannedMinutes: "25",
  })

  // Knowledge save
  const [knowledgeStep, setKnowledgeStep] = useState<"idle" | "generating" | "review" | "saving" | "saved">("idle")
  const [knowledgeCategories, setKnowledgeCategories] = useState<KnowledgeCategory[]>([])
  const [knowledgeForm, setKnowledgeForm] = useState({
    title: "",
    content: "",
    categoryId: "",
  })
  const [knowledgeError, setKnowledgeError] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialLoadDoneRef = useRef(false)

  useEffect(() => {
    fetchCategories()
    fetchSprints()
    fetchPeriods()
    fetchConversations()
    fetchSettings()
  }, [])

  // Mode change is now handled explicitly in the UI when user clicks on a mode button
  // This prevents clearing messages when loading an existing conversation

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories?workspace=WORK")
      if (res.ok) setCategories(await res.json())
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const fetchSprints = async () => {
    try {
      const res = await fetch("/api/sprints?workspace=WORK")
      if (res.ok) setSprints(await res.json())
    } catch (error) {
      console.error("Error fetching sprints:", error)
    }
  }

  const fetchPeriods = async () => {
    try {
      const res = await fetch("/api/periods?workspace=WORK")
      if (res.ok) setPeriods(await res.json())
    } catch (error) {
      console.error("Error fetching periods:", error)
    }
  }

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/ai/conversations?workspace=WORK")
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error("Error fetching conversations:", error)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/ai/settings?workspace=WORK")
      if (res.ok) {
        const data = await res.json()
        setChatInstructions(data.instructions || {})
        setSystemPrompts(data.systemPrompts || {})
        setMetaPrompt(data.metaPrompt || "")
        setCompanyInfo(data.companyInfo || "")
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const fetchKnowledgeCategories = async () => {
    try {
      const res = await fetch("/api/knowledge/categories?workspace=WORK")
      if (res.ok) {
        const data = await res.json()
        const flatCats: KnowledgeCategory[] = []
        const flatten = (cats: KnowledgeCategory[], prefix = "") => {
          for (const cat of cats) {
            flatCats.push({ id: cat.id, name: prefix + cat.name, color: cat.color })
            if ((cat as unknown as { children?: KnowledgeCategory[] }).children) {
              flatten((cat as unknown as { children: KnowledgeCategory[] }).children, prefix + "— ")
            }
          }
        }
        flatten(data.strategicCategories || [])
        flatten(data.customCategories || [])
        setKnowledgeCategories(flatCats)
      }
    } catch (error) {
      console.error("Error fetching knowledge categories:", error)
    }
  }

  const loadConversation = async (convId: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`)
      if (res.ok) {
        const data = await res.json()
        const conv = data.conversation
        setCurrentConversationId(conv.id)
        setMessages(
          conv.messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        )
        if (conv.type === "GENERAL") setMode("general")
        setShowHistory(false)
      }
    } catch (error) {
      console.error("Error loading conversation:", error)
    }
  }

  // Auto-load the most recent conversation on first page load
  useEffect(() => {
    if (!initialLoadDoneRef.current && conversations.length > 0) {
      initialLoadDoneRef.current = true
      loadConversation(conversations[0].id)
    }
  }, [conversations])

  const deleteConversation = async (convId: string) => {
    try {
      await fetch(`/api/ai/conversations/${convId}`, { method: "DELETE" })
      setConversations((prev) => prev.filter((c) => c.id !== convId))
      if (currentConversationId === convId) {
        setMessages([])
        setCurrentConversationId(null)
      }
    } catch (error) {
      console.error("Error deleting conversation:", error)
    }
  }

  const startNewConversation = () => {
    setMessages([])
    setCurrentConversationId(null)
    setShowHistory(false)
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      await fetch("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: "WORK", instructions: chatInstructions, systemPrompts, metaPrompt, companyInfo }),
      })
      setShowSettings(false)
      setShowAdvancedSettings(false)
    } catch (error) {
      console.error("Error saving settings:", error)
    } finally {
      setSavingSettings(false)
    }
  }

  const saveToConversation = async (newMessages: ChatMessage[]) => {
    try {
      if (currentConversationId) {
        await fetch(`/api/ai/conversations/${currentConversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        })
      } else {
        const createRes = await fetch("/api/ai/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: MODE_TO_API_TYPE[mode], workspace: "WORK" }),
        })
        if (createRes.ok) {
          const createData = await createRes.json()
          const convId = createData.conversation.id
          setCurrentConversationId(convId)
          await fetch(`/api/ai/conversations/${convId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
              summary: newMessages[0]?.content?.slice(0, 50),
            }),
          })
          fetchConversations()
        }
      }
    } catch (error) {
      console.error("Error saving conversation:", error)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = { role: "user", content: input }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          mode,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const assistantMessage: ChatMessage = { role: "assistant", content: data.message || "" }

        if (data.type === "goals_proposal" && data.goals) {
          assistantMessage.data = data.goals
          assistantMessage.dataType = "goals"
        } else if (data.type === "tasks_proposal" && data.tasks) {
          assistantMessage.data = data.tasks
          assistantMessage.dataType = "tasks"
        }

        const finalMessages = [...updatedMessages, assistantMessage]
        setMessages(finalMessages)
        setLastAssistantIndex(finalMessages.length - 1)
        saveToConversation(finalMessages)
      } else {
        const errorMessages = [...updatedMessages, { role: "assistant" as const, content: "Przepraszam, wystąpił błąd. Spróbuj ponownie." }]
        setMessages(errorMessages)
        setLastAssistantIndex(errorMessages.length - 1)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages([...updatedMessages, { role: "assistant", content: "Przepraszam, wystąpił błąd. Spróbuj ponownie." }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStartAddGoal = (goal: GoalProposal) => {
    setAddingGoal(goal)
    const category = categories.find((c) => c.name === goal.category)
    setGoalForm({
      title: goal.title,
      description: goal.description || "",
      targetValue: goal.targetValue?.toString() || "",
      unit: goal.unit || "",
      categoryId: category?.id || "",
      sprintId: "",
      periodId: "",
    })
  }

  const handleAddGoal = async () => {
    if (!goalForm.title) return
    // Require either sprintId or periodId (works from any chat mode)
    if (!goalForm.sprintId && !goalForm.periodId) return

    try {
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalForm.title,
          description: goalForm.description || undefined,
          targetValue: goalForm.targetValue ? parseFloat(goalForm.targetValue) : undefined,
          unit: goalForm.unit || undefined,
          categoryId: goalForm.categoryId || undefined,
          sprintId: goalForm.sprintId || undefined,
          periodId: goalForm.periodId || undefined,
          workspaceType: "WORK",
        }),
      })
      setAddingGoal(null)
      setGoalForm({ title: "", description: "", targetValue: "", unit: "", categoryId: "", sprintId: "", periodId: "" })
    } catch (error) {
      console.error("Error adding goal:", error)
    }
  }

  const handleStartAddTask = (task: TaskProposal) => {
    setAddingTask(task)
    const category = categories.find((c) => c.name === task.category)
    setTaskForm({
      title: task.title,
      categoryId: category?.id || "",
      plannedMinutes: task.plannedMinutes?.toString() || "25",
    })
  }

  const handleAddTask = async () => {
    if (!taskForm.title) return
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title,
          categoryId: taskForm.categoryId || undefined,
          plannedMinutes: parseInt(taskForm.plannedMinutes) || 25,
          scheduledDate: format(new Date(), "yyyy-MM-dd"),
          workspaceType: "WORK",
          status: "NEW",
        }),
      })
      setAddingTask(null)
      setTaskForm({ title: "", categoryId: "", plannedMinutes: "25" })
    } catch (error) {
      console.error("Error adding task:", error)
    }
  }

  const handleStartSaveKnowledge = async () => {
    fetchKnowledgeCategories()
    setKnowledgeStep("generating")
    setKnowledgeForm({ title: "", content: "", categoryId: "" })

    const conversationText = messages.map((m) => `${m.role === "user" ? "Użytkownik" : "Asystent"}: ${m.content}`).join("\n\n")

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Stwórz zwięzłe podsumowanie poniższej rozmowy dla bazy wiedzy. Wyodrębnij kluczowe informacje. Odpowiedz tylko podsumowaniem.\n\nRozmowa:\n${conversationText}`,
          mode: "general",
          history: [],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setKnowledgeForm({ title: "", content: data.message || conversationText, categoryId: "" })
      } else {
        setKnowledgeForm({ title: "", content: conversationText, categoryId: "" })
      }
      setKnowledgeStep("review")
    } catch (error) {
      console.error("Error generating summary:", error)
      setKnowledgeForm({ title: "", content: conversationText, categoryId: "" })
      setKnowledgeStep("review")
    }
  }

  const handleSaveKnowledge = async () => {
    if (!knowledgeForm.content || !knowledgeForm.categoryId) return
    setKnowledgeStep("saving")
    setKnowledgeError("")
    try {
      const res = await fetch("/api/knowledge/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: knowledgeForm.title || "Notatka z rozmowy AI",
          newInfo: knowledgeForm.content,
          categoryId: knowledgeForm.categoryId,
          workspace: "WORK",
        }),
      })
      if (res.ok) {
        setKnowledgeStep("saved")
        // Invalidate knowledge cache so the knowledge page shows new entry immediately
        mutate((key) => typeof key === "string" && key.startsWith("/api/knowledge"))
        setTimeout(() => {
          setKnowledgeStep("idle")
          setKnowledgeForm({ title: "", content: "", categoryId: "" })
          setKnowledgeError("")
        }, 2000)
      } else {
        const errorData = await res.json().catch(() => ({}))
        setKnowledgeError(errorData.error || "Nie udało się zapisać.")
        setKnowledgeStep("review")
      }
    } catch (error) {
      console.error("Error saving knowledge:", error)
      setKnowledgeError("Wystąpił błąd.")
      setKnowledgeStep("review")
    }
  }

  const getQuickPrompts = () => {
    if (mode === "period_goals") return ["Zaproponuj cele na okres", "Jakie strategiczne cele powinienem postawić?"]
    if (mode === "sprint_goals") return ["Zaproponuj cele na sprint", "Co powinienem osiągnąć w najbliższych 2 tygodniach?"]
    if (mode === "general") return ["Co mam teraz na tapecie?", "Pomóż mi przemyśleć...", "Mam problem z..."]
    return ["Zaproponuj zadania na dziś", "Co powinienem dziś zrobić?"]
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)] md:h-[calc(100dvh-8rem)]">
      {/* Header - compact */}
      <div className="flex items-center justify-between pb-3 border-b mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Asystent AI</h1>
            <p className="text-xs text-muted-foreground">Twój partner do planowania</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Sheet open={showHistory} onOpenChange={setShowHistory}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <History className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Historia rozmów</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                <Button onClick={startNewConversation} variant="outline" className="w-full justify-start gap-2">
                  <Plus className="h-4 w-4" />
                  Nowa rozmowa
                </Button>
                <div className="space-y-1 mt-4">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Brak zapisanych rozmów</p>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted group",
                          currentConversationId === conv.id && "bg-muted"
                        )}
                        onClick={() => loadConversation(conv.id)}
                      >
                        <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{conv.summary}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true, locale: pl })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mode selector - pill style */}
      <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-hide">
        {(Object.entries(MODE_CONFIG) as [ChatMode, typeof MODE_CONFIG[ChatMode]][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => {
              if (mode !== key) {
                setMode(key)
                startNewConversation()
              }
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              mode === key
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            {config.icon}
            {config.label}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-3 px-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center mb-4", MODE_CONFIG[mode].color)}>
              {MODE_CONFIG[mode].icon && <div className="text-white scale-150">{MODE_CONFIG[mode].icon}</div>}
            </div>
            <h2 className="text-xl font-semibold mb-2">{MODE_CONFIG[mode].description}</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {mode === "general"
                ? "Zadaj mi pytanie, poproś o analizę problemu, lub po prostu porozmawiajmy."
                : "Powiedz mi co chcesz osiągnąć, a pomogę Ci to zaplanować."}
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {getQuickPrompts().map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  onClick={() => { setInput(prompt); inputRef.current?.focus() }}
                  className="text-xs"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3 animate-fade-in",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                  message.role === "user"
                    ? "bg-primary"
                    : "bg-gradient-to-br from-violet-500 to-purple-600"
                )}>
                  {message.role === "user"
                    ? <User className="h-4 w-4 text-primary-foreground" />
                    : <Bot className="h-4 w-4 text-white" />
                  }
                </div>
                <div className={cn(
                  "max-w-[85%] md:max-w-[75%]",
                  message.role === "user" ? "text-right" : ""
                )}>
                  <div className={cn(
                    "rounded-2xl px-4 py-3 inline-block text-left",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}>
                    {message.role === "user" ? (
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    ) : (
                      <TypingMessage content={message.content} isNew={index === lastAssistantIndex} />
                    )}
                  </div>

                  {/* Goals proposal */}
                  {message.dataType === "goals" && message.data && (
                    <div className="mt-3 space-y-2">
                      {(message.data as GoalProposal[]).map((goal, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-card border rounded-xl hover:border-primary/50 transition-colors">
                          <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                            <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{goal.title}</div>
                            {goal.category && <Badge variant="secondary" className="text-[10px] mt-1">{goal.category}</Badge>}
                            {goal.targetValue && <div className="text-xs text-muted-foreground mt-1">Cel: {goal.targetValue} {goal.unit}</div>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleStartAddGoal(goal)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Dodaj
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tasks proposal */}
                  {message.dataType === "tasks" && message.data && (
                    <div className="mt-3 space-y-2">
                      {(message.data as TaskProposal[]).map((task, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-card border rounded-xl hover:border-primary/50 transition-colors">
                          <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{task.title}</div>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {task.category && <Badge variant="secondary" className="text-[10px]">{task.category}</Badge>}
                              {task.plannedMinutes && <span className="text-xs text-muted-foreground">{task.plannedMinutes} min</span>}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleStartAddTask(task)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Dodaj
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom actions & input */}
      <div className="pt-3 border-t mt-auto space-y-2">
        {messages.length > 0 && knowledgeStep === "idle" && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartSaveKnowledge}
              className="text-xs text-muted-foreground"
            >
              <BookOpen className="h-3 w-3 mr-1" />
              Zapisz do wiedzy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewConversation}
              className="text-xs text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Nowa rozmowa
            </Button>
          </div>
        )}

        {knowledgeStep === "generating" && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Tworzę podsumowanie...
            </div>
          </div>
        )}

        {knowledgeStep === "review" && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
            <Textarea
              value={knowledgeForm.content}
              onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
              rows={3}
              className="text-sm"
              placeholder="Podsumowanie rozmowy..."
            />
            <Select
              value={knowledgeForm.categoryId || "none"}
              onValueChange={(v) => setKnowledgeForm({ ...knowledgeForm, categoryId: v === "none" ? "" : v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Wybierz kategorię..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Wybierz kategorię</SelectItem>
                {knowledgeCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {knowledgeError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {knowledgeError}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSaveKnowledge} disabled={!knowledgeForm.content || !knowledgeForm.categoryId} size="sm" className="flex-1">
                <BookOpen className="h-4 w-4 mr-2" />
                Zapisz
              </Button>
              <Button onClick={() => { setKnowledgeStep("idle"); setKnowledgeError("") }} variant="outline" size="sm">
                Anuluj
              </Button>
            </div>
          </div>
        )}

        {knowledgeStep === "saving" && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Zapisuję...
            </div>
          </div>
        )}

        {knowledgeStep === "saved" && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              Zapisano do bazy wiedzy!
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napisz wiadomość..."
            disabled={isLoading || knowledgeStep !== "idle"}
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || knowledgeStep !== "idle"}
            size="icon"
            className="h-11 w-11 rounded-xl flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Ustawienia AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            {/* Company/Project Context */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Kontekst firmy / projektu</Label>
              <p className="text-xs text-muted-foreground">
                Opisz czym się zajmujesz, jakie masz projekty, co znaczy u Ciebie "backlog", jakie masz role itp. AI będzie to wiedział w każdej rozmowie.
              </p>
              <Textarea
                value={companyInfo}
                onChange={(e) => setCompanyInfo(e.target.value)}
                placeholder="Np. Prowadzę software house. Mam 3 główne projekty: Zadaniomat (aplikacja do zarządzania czasem), Klient X (e-commerce), Klient Y (SaaS). Backlog = lista funkcji do zrobienia w projekcie. Jestem CEO i głównym developerem..."
                rows={4}
                className="text-sm"
              />
            </div>

            {/* Advanced: System Prompts */}
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="h-4 w-4" />
                {showAdvancedSettings ? "Ukryj" : "Pokaż"} zaawansowane ustawienia (prompty systemowe)
              </button>

              {showAdvancedSettings && (
                <div className="mt-4 space-y-4">
                  {/* Meta Prompt - FIRST */}
                  <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <Label className="text-sm font-medium">🔥 Nadrzędne instrukcje (czytane PIERWSZE)</Label>
                    <p className="text-xs text-muted-foreground">
                      Te zasady AI przeczyta PRZED wszystkim innym. Tutaj ustaw rzeczy typu "bądź elastyczny", "nie wracaj do poprzednich tematów" itp.
                    </p>
                    <Textarea
                      value={metaPrompt}
                      onChange={(e) => setMetaPrompt(e.target.value)}
                      placeholder="Np. Bądź elastyczny. Jak zmieniam temat - idź za mną. Nie wracaj do sprintów/celów jeśli o nich nie mówię..."
                      rows={5}
                      className="text-xs font-mono"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Poniżej możesz edytować bazowe prompty systemowe dla każdego trybu chatu. To jest "osobowość" AI.
                    Zmieniaj ostrożnie - to wpływa na całe zachowanie asystenta.
                  </p>
                  {(Object.entries(MODE_CONFIG) as [ChatMode, typeof MODE_CONFIG[ChatMode]][]).map(([key, config]) => (
                    <div key={`prompt-${key}`} className="space-y-1">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        {config.icon}
                        Prompt systemowy: {config.label}
                      </Label>
                      <Textarea
                        value={systemPrompts[key] || ""}
                        onChange={(e) => setSystemPrompts({ ...systemPrompts, [key]: e.target.value })}
                        placeholder={`Bazowy prompt dla trybu "${config.label}"...`}
                        rows={6}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Instructions per mode */}
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-2 block">Dodatkowe instrukcje per tryb</Label>
              <p className="text-xs text-muted-foreground mb-4">
                Krótkie wytyczne dodawane do promptu. Np. "Mów krótko", "Nie proponuj od razu".
              </p>
              <div className="space-y-4">
                {(Object.entries(MODE_CONFIG) as [ChatMode, typeof MODE_CONFIG[ChatMode]][]).map(([key, config]) => (
                  <div key={`instr-${key}`}>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      {config.icon}
                      {config.label}
                    </Label>
                    <Textarea
                      value={chatInstructions[key] || ""}
                      onChange={(e) => setChatInstructions({ ...chatInstructions, [key]: e.target.value })}
                      placeholder={`Dodatkowe instrukcje dla "${config.label}"...`}
                      rows={2}
                      className="mt-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={saveSettings} disabled={savingSettings} className="flex-1">
                {savingSettings && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Zapisz
              </Button>
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Anuluj
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Goal Dialog */}
      <Dialog open={!!addingGoal} onOpenChange={(open) => !open && setAddingGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj cel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Tytuł</Label>
              <Input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Wartość docelowa</Label>
                <Input type="number" value={goalForm.targetValue} onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })} />
              </div>
              <div>
                <Label>Jednostka</Label>
                <Input value={goalForm.unit} onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })} placeholder="np. zadań" />
              </div>
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select value={goalForm.categoryId || "none"} onValueChange={(v) => setGoalForm({ ...goalForm, categoryId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak kategorii</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sprint (opcjonalnie)</Label>
                <Select
                  value={goalForm.sprintId || "none"}
                  onValueChange={(v) => setGoalForm({ ...goalForm, sprintId: v === "none" ? "" : v, periodId: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak</SelectItem>
                    {sprints.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Okres (opcjonalnie)</Label>
                <Select
                  value={goalForm.periodId || "none"}
                  onValueChange={(v) => setGoalForm({ ...goalForm, periodId: v === "none" ? "" : v, sprintId: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak</SelectItem>
                    {periods.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Wybierz sprint lub okres, do którego chcesz dodać cel.</p>
            <Button
              onClick={handleAddGoal}
              className="w-full"
              disabled={!goalForm.title || (!goalForm.periodId && !goalForm.sprintId)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj cel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={!!addingTask} onOpenChange={(open) => !open && setAddingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj zadanie na dziś</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Tytuł</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select value={taskForm.categoryId || "none"} onValueChange={(v) => setTaskForm({ ...taskForm, categoryId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak kategorii</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Czas (minuty)</Label>
              <Input type="number" value={taskForm.plannedMinutes} onChange={(e) => setTaskForm({ ...taskForm, plannedMinutes: e.target.value })} />
            </div>
            <Button onClick={handleAddTask} className="w-full" disabled={!taskForm.title}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj zadanie
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
