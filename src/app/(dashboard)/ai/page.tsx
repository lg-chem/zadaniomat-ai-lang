"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type ChatMode = "daily_tasks" | "period_goals" | "sprint_goals" | "general"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  data?: GoalProposal[] | TaskProposal[]
  dataType?: "goals" | "tasks"
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

const MODE_LABELS: Record<ChatMode, string> = {
  daily_tasks: "Zadania na dziś",
  period_goals: "Cele na okres",
  sprint_goals: "Cele sprintu",
  general: "Ogólny czat",
}

const MODE_TO_API_TYPE: Record<ChatMode, string> = {
  daily_tasks: "PLANNING",
  period_goals: "PLANNING",
  sprint_goals: "PLANNING",
  general: "GENERAL",
}

export default function AIPage() {
  const [mode, setMode] = useState<ChatMode>("daily_tasks")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingMessage, setTypingMessage] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [periods, setPeriods] = useState<Period[]>([])

  // Conversation history
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [chatInstructions, setChatInstructions] = useState<Record<string, string>>({})
  const [savingSettings, setSavingSettings] = useState(false)

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

  // Knowledge save dialog
  const [knowledgeStep, setKnowledgeStep] = useState<"idle" | "generating" | "review" | "saving" | "saved">("idle")
  const [knowledgeCategories, setKnowledgeCategories] = useState<KnowledgeCategory[]>([])
  const [knowledgeForm, setKnowledgeForm] = useState({
    title: "",
    content: "",
    categoryId: "",
  })
  const [knowledgeError, setKnowledgeError] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchCategories()
    fetchSprints()
    fetchPeriods()
    fetchConversations()
    fetchSettings()
  }, [])

  useEffect(() => {
    setMessages([])
    setCurrentConversationId(null)
  }, [mode])

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories?workspace=WORK")
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const fetchSprints = async () => {
    try {
      const res = await fetch("/api/sprints?workspace=WORK")
      if (res.ok) {
        const data = await res.json()
        setSprints(data)
      }
    } catch (error) {
      console.error("Error fetching sprints:", error)
    }
  }

  const fetchPeriods = async () => {
    try {
      const res = await fetch("/api/periods?workspace=WORK")
      if (res.ok) {
        const data = await res.json()
        setPeriods(data)
      }
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
        body: JSON.stringify({ workspace: "WORK", instructions: chatInstructions }),
      })
      setShowSettings(false)
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
    setMessages((prev) => [...prev, userMessage])
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

        setIsTyping(true)
        setTypingMessage("")
        const fullText = assistantMessage.content
        let currentIndex = 0

        const typingInterval = setInterval(() => {
          if (currentIndex < fullText.length) {
            setTypingMessage(fullText.slice(0, currentIndex + 1))
            currentIndex++
          } else {
            clearInterval(typingInterval)
            setIsTyping(false)
            setTypingMessage("")
            setMessages((prev) => [...prev, assistantMessage])
            saveToConversation([userMessage, assistantMessage])
          }
        }, 20)
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Przepraszam, wystąpił błąd. Spróbuj ponownie." }])
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => [...prev, { role: "assistant", content: "Przepraszam, wystąpił błąd. Spróbuj ponownie." }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
    if (mode === "period_goals" && !goalForm.periodId) return
    if (mode === "sprint_goals" && !goalForm.sprintId) return

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
          sprintId: mode === "sprint_goals" ? goalForm.sprintId : undefined,
          periodId: mode === "period_goals" ? goalForm.periodId : undefined,
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

  const handleCancelKnowledge = () => {
    setKnowledgeStep("idle")
    setKnowledgeForm({ title: "", content: "", categoryId: "" })
    setKnowledgeError("")
  }

  const getQuickPrompts = () => {
    if (mode === "period_goals") return ["Zaproponuj długoterminowe cele", "Jakie strategiczne cele powinienem postawić?", "Pomóż zaplanować cele na 3 miesiące"]
    if (mode === "sprint_goals") return ["Zaproponuj cele na sprint", "Jakie cele powinienem sobie postawić?", "Pokaż moje cele i zasugeruj ulepszenia"]
    if (mode === "general") return ["W czym mogę Ci pomóc?", "Mam pytanie dotyczące pracy...", "Pomóż mi przeanalizować problem"]
    return ["Zaproponuj zadania na dziś", "Co powinienem dziś zrobić?", "Zaplanuj mój dzień"]
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 8rem)", minHeight: "400px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 md:mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 md:h-8 md:w-8 text-primary" />
            Asystent AI
          </h1>
          <p className="text-xs md:text-base text-muted-foreground">Pomogę Ci zaplanować cele i zadania</p>
        </div>
        <div className="flex gap-2">
          <Sheet open={showHistory} onOpenChange={setShowHistory}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" title="Historia rozmów">
                <History className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Historia rozmów
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                <Button onClick={startNewConversation} variant="outline" className="w-full justify-start gap-2">
                  <Plus className="h-4 w-4" />
                  Nowa rozmowa
                </Button>
                <p className="text-xs text-muted-foreground px-2 pt-2">Rozmowy są przechowywane przez 3 dni</p>
                <div className="space-y-1 mt-2">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Brak zapisanych rozmów</p>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted group ${currentConversationId === conv.id ? "bg-muted" : ""}`}
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
          <Button variant="outline" size="icon" title="Ustawienia" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as ChatMode)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full max-w-3xl grid-cols-4 flex-shrink-0">
          <TabsTrigger value="daily_tasks" className="text-xs sm:text-sm"><CalendarDays className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Zadania</span></TabsTrigger>
          <TabsTrigger value="period_goals" className="text-xs sm:text-sm"><Target className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Okres</span></TabsTrigger>
          <TabsTrigger value="sprint_goals" className="text-xs sm:text-sm"><Target className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Sprint</span></TabsTrigger>
          <TabsTrigger value="general" className="text-xs sm:text-sm"><MessageSquare className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Ogólny</span></TabsTrigger>
        </TabsList>

        <TabsContent value={mode} className="flex-1 flex flex-col mt-2 md:mt-4 min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col p-3 md:p-4 min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 mb-2 md:mb-4 min-h-0">
                {messages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">{mode === "general" ? "W czym mogę Ci dzisiaj pomóc?" : mode === "sprint_goals" ? "Pomogę Ci zaplanować cele na sprint" : mode === "period_goals" ? "Pomogę Ci zaplanować cele na okres" : "Pomogę Ci zaplanować zadania na dziś"}</p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                      {getQuickPrompts().map((prompt) => (
                        <Button key={prompt} variant="outline" size="sm" onClick={() => { setInput(prompt); inputRef.current?.focus() }} className="text-xs md:text-sm">{prompt}</Button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Bot className="h-4 w-4 text-primary" /></div>}
                    <div className={`max-w-[80%] rounded-lg p-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.dataType === "goals" && message.data && (
                        <div className="mt-3 space-y-2">
                          {(message.data as GoalProposal[]).map((goal, i) => (
                            <div key={i} className="flex items-start justify-between gap-2 p-2.5 bg-background rounded-lg border hover:border-primary/50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm break-words">{goal.title}</div>
                                {goal.category && <Badge variant="secondary" className="text-[10px] mt-1">{goal.category}</Badge>}
                                {goal.targetValue && <div className="text-xs text-muted-foreground mt-1">Cel: {goal.targetValue} {goal.unit}</div>}
                              </div>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleStartAddGoal(goal)}><Plus className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {message.dataType === "tasks" && message.data && (
                        <div className="mt-3 space-y-2">
                          {(message.data as TaskProposal[]).map((task, i) => (
                            <div key={i} className="flex items-start justify-between gap-2 p-2.5 bg-background rounded-lg border hover:border-primary/50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm break-words">{task.title}</div>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {task.category && <Badge variant="secondary" className="text-[10px]">{task.category}</Badge>}
                                  {task.plannedMinutes && <span className="text-xs text-muted-foreground">{task.plannedMinutes} min</span>}
                                </div>
                              </div>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleStartAddTask(task)}><Plus className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.role === "user" && <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><User className="h-4 w-4 text-primary-foreground" /></div>}
                  </div>
                ))}

                {isTyping && typingMessage && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Bot className="h-4 w-4 text-primary" /></div>
                    <div className="bg-muted rounded-lg p-3 flex-1"><p className="whitespace-pre-wrap">{typingMessage}<span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse" /></p></div>
                  </div>
                )}

                {isLoading && !isTyping && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-4 w-4 text-primary" /></div>
                    <div className="bg-muted rounded-lg p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {messages.length > 0 && knowledgeStep === "idle" && (
                <button onClick={handleStartSaveKnowledge} className="w-full p-2 mb-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <BookOpen className="h-4 w-4" />Zapisz do bazy wiedzy
                </button>
              )}

              {knowledgeStep === "generating" && <div className="mb-2 p-3 bg-primary/5 rounded-lg border border-primary/20"><div className="flex items-center gap-2 text-sm text-primary"><Loader2 className="h-4 w-4 animate-spin" />Tworzę podsumowanie...</div></div>}

              {knowledgeStep === "review" && (
                <div className="mb-2 p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                  <div className="text-sm font-medium">Podsumowanie:</div>
                  <Textarea value={knowledgeForm.content} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })} rows={3} className="text-sm" />
                  <div>
                    <Label className="text-xs">Kategoria</Label>
                    <Select value={knowledgeForm.categoryId || "none"} onValueChange={(v) => setKnowledgeForm({ ...knowledgeForm, categoryId: v === "none" ? "" : v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Wybierz kategorię..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Wybierz kategorię</SelectItem>
                        {knowledgeCategories.map((cat) => <SelectItem key={cat.id} value={cat.id}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</div></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {knowledgeError && <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm text-red-600"><AlertTriangle className="h-4 w-4" />{knowledgeError}</div>}
                  <div className="flex gap-2">
                    <Button onClick={handleSaveKnowledge} disabled={!knowledgeForm.content || !knowledgeForm.categoryId} size="sm" className="flex-1"><BookOpen className="h-4 w-4 mr-2" />Zapisz</Button>
                    <Button onClick={handleCancelKnowledge} variant="outline" size="sm">Anuluj</Button>
                  </div>
                </div>
              )}

              {knowledgeStep === "saving" && <div className="mb-2 p-3 bg-primary/5 rounded-lg border border-primary/20"><div className="flex items-center gap-2 text-sm text-primary"><Loader2 className="h-4 w-4 animate-spin" />Zapisuję...</div></div>}
              {knowledgeStep === "saved" && <div className="mb-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800"><div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"><Check className="h-4 w-4" />Zapisano!</div></div>}

              <div className="flex gap-2 flex-shrink-0 pt-2 border-t mt-auto">
                <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Napisz wiadomość..." disabled={isLoading || knowledgeStep !== "idle"} className="text-sm md:text-base" />
                <Button onClick={handleSend} disabled={isLoading || !input.trim() || knowledgeStep !== "idle"} size="icon" className="flex-shrink-0 h-10 w-10"><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Ustawienia czatu AI</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Dodaj instrukcje, jak AI ma się zachowywać w każdym trybie czatu.</p>
            {(["general", "daily_tasks", "sprint_goals", "period_goals"] as ChatMode[]).map((m) => (
              <div key={m}>
                <Label className="text-sm font-medium">{MODE_LABELS[m]}</Label>
                <Textarea value={chatInstructions[m] || ""} onChange={(e) => setChatInstructions({ ...chatInstructions, [m]: e.target.value })} placeholder={`Instrukcje dla "${MODE_LABELS[m]}"...`} rows={2} className="mt-1 text-sm" />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button onClick={saveSettings} disabled={savingSettings} className="flex-1">{savingSettings && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Zapisz ustawienia</Button>
              <Button variant="outline" onClick={() => setShowSettings(false)}>Anuluj</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Goal Dialog */}
      <Dialog open={!!addingGoal} onOpenChange={(open) => !open && setAddingGoal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mode === "period_goals" ? "Dodaj cel na okres" : "Dodaj cel do sprintu"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div><Label>Tytuł</Label><Input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} /></div>
            <div><Label>Opis (opcjonalnie)</Label><Input value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Wartość docelowa</Label><Input type="number" value={goalForm.targetValue} onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })} /></div>
              <div><Label>Jednostka</Label><Input value={goalForm.unit} onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })} placeholder="np. zadań" /></div>
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select value={goalForm.categoryId || "none"} onValueChange={(v) => setGoalForm({ ...goalForm, categoryId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Wybierz kategorię..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak kategorii</SelectItem>
                  {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</div></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mode === "period_goals" ? (
              <div>
                <Label>Okres</Label>
                <Select value={goalForm.periodId || "none"} onValueChange={(v) => setGoalForm({ ...goalForm, periodId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Wybierz okres..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Wybierz okres</SelectItem>
                    {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Sprint</Label>
                <Select value={goalForm.sprintId || "none"} onValueChange={(v) => setGoalForm({ ...goalForm, sprintId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Wybierz sprint..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Wybierz sprint</SelectItem>
                    {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleAddGoal} className="w-full" disabled={!goalForm.title || (mode === "period_goals" ? !goalForm.periodId : !goalForm.sprintId)}><Plus className="h-4 w-4 mr-2" />Dodaj cel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={!!addingTask} onOpenChange={(open) => !open && setAddingTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj zadanie na dziś</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div><Label>Tytuł</Label><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
            <div>
              <Label>Kategoria</Label>
              <Select value={taskForm.categoryId || "none"} onValueChange={(v) => setTaskForm({ ...taskForm, categoryId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Wybierz kategorię..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak kategorii</SelectItem>
                  {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</div></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Planowany czas (minuty)</Label><Input type="number" value={taskForm.plannedMinutes} onChange={(e) => setTaskForm({ ...taskForm, plannedMinutes: e.target.value })} /></div>
            <Button onClick={handleAddTask} className="w-full" disabled={!taskForm.title}><Plus className="h-4 w-4 mr-2" />Dodaj zadanie</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
