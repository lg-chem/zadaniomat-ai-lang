"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { format } from "date-fns"
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

type ChatMode = "sprint_goals" | "daily_tasks" | "period_goals"

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

  // Knowledge save dialog - conversational flow
  const [knowledgeStep, setKnowledgeStep] = useState<"idle" | "generating" | "review" | "saving" | "saved">("idle")
  const [knowledgeCategories, setKnowledgeCategories] = useState<KnowledgeCategory[]>([])
  const [knowledgeForm, setKnowledgeForm] = useState({
    title: "",
    content: "",
    categoryId: "",
  })
  const [knowledgeSummary, setKnowledgeSummary] = useState("")
  const [knowledgeError, setKnowledgeError] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchCategories()
    fetchSprints()
    fetchPeriods()

    // Check for context from backlog discussion
    const aiChatContext = sessionStorage.getItem("aiChatContext")
    if (aiChatContext) {
      try {
        const context = JSON.parse(aiChatContext)
        if (context.type === "backlog_discussion") {
          // Pre-populate conversation with backlog context
          setMessages([
            {
              role: "user",
              content: `Kontynuujmy rozmowę o pomyśle z backlogu: "${context.content}"`,
            },
            {
              role: "assistant",
              content: context.aiResponse || "Chętnie pomogę z tym pomysłem. W czym mogę pomóc?",
            },
          ])
          // Clear context after using
          sessionStorage.removeItem("aiChatContext")
        }
      } catch (e) {
        console.error("Error parsing AI chat context:", e)
        sessionStorage.removeItem("aiChatContext")
      }
    }
  }, [])

  // Removed auto-scroll - let user read from top

  useEffect(() => {
    // Clear messages when mode changes (but only if not pre-populated)
    if (messages.length === 0 || !sessionStorage.getItem("aiChatContext")) {
      // Don't clear if we just loaded context
    }
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

  const fetchKnowledgeCategories = async () => {
    try {
      const res = await fetch("/api/knowledge/categories?workspace=WORK")
      if (res.ok) {
        const data = await res.json()
        // Flatten categories for simple selection
        const flatCats: KnowledgeCategory[] = []
        const flatten = (cats: KnowledgeCategory[], prefix = "") => {
          for (const cat of cats) {
            flatCats.push({ id: cat.id, name: prefix + cat.name, color: cat.color })
            if ((cat as unknown as { children?: KnowledgeCategory[] }).children) {
              flatten((cat as unknown as { children: KnowledgeCategory[] }).children, prefix + "— ")
            }
          }
        }
        flatten(data.categories || [])
        setKnowledgeCategories(flatCats)
      }
    } catch (error) {
      console.error("Error fetching knowledge categories:", error)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: "user",
      content: input,
    }

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
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (res.ok) {
        const data = await res.json()

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message || "",
        }

        if (data.type === "goals_proposal" && data.goals) {
          assistantMessage.data = data.goals
          assistantMessage.dataType = "goals"
        } else if (data.type === "tasks_proposal" && data.tasks) {
          assistantMessage.data = data.tasks
          assistantMessage.dataType = "tasks"
        }

        // Typing effect - show message character by character
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
          }
        }, 20) // 20ms per character for smooth typing

      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Przepraszam, wystąpił błąd. Upewnij się, że GEMINI_API_KEY jest skonfigurowany.",
          },
        ])
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Przepraszam, wystąpił błąd. Spróbuj ponownie.",
        },
      ])
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
    // For period goals, require periodId; for sprint goals, require sprintId
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
      setGoalForm({
        title: "",
        description: "",
        targetValue: "",
        unit: "",
        categoryId: "",
        sprintId: "",
        periodId: "",
      })
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
      setTaskForm({
        title: "",
        categoryId: "",
        plannedMinutes: "25",
      })
    } catch (error) {
      console.error("Error adding task:", error)
    }
  }

  const handleStartSaveKnowledge = async () => {
    // Fetch categories when starting
    fetchKnowledgeCategories()
    setKnowledgeStep("generating")
    setKnowledgeSummary("")
    setKnowledgeForm({ title: "", content: "", categoryId: "" })

    // Build conversation for AI to summarize
    const conversationText = messages
      .map((m) => `${m.role === "user" ? "Użytkownik" : "Asystent"}: ${m.content}`)
      .join("\n\n")

    try {
      // Ask AI to create a concise summary
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Stwórz zwięzłe podsumowanie poniższej rozmowy, które będzie nadawać się do zapisania w bazie wiedzy. Wyodrębnij kluczowe informacje, fakty i wnioski. Odpowiedz tylko podsumowaniem, bez dodatkowych komentarzy.\n\nRozmowa:\n${conversationText}`,
          mode: "daily_tasks",
          history: [],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setKnowledgeSummary(data.message || conversationText)
        setKnowledgeForm({
          title: "",
          content: data.message || conversationText,
          categoryId: "",
        })
        setKnowledgeStep("review")
      } else {
        // Fallback to raw conversation
        setKnowledgeSummary(conversationText)
        setKnowledgeForm({
          title: "",
          content: conversationText,
          categoryId: "",
        })
        setKnowledgeStep("review")
      }
    } catch (error) {
      console.error("Error generating summary:", error)
      setKnowledgeForm({
        title: "",
        content: conversationText,
        categoryId: "",
      })
      setKnowledgeStep("review")
    }
  }

  const handleSaveKnowledge = async () => {
    if (!knowledgeForm.content || !knowledgeForm.categoryId) return

    setKnowledgeStep("saving")
    setKnowledgeError("")
    try {
      // Use the merge endpoint for intelligent update
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
          setKnowledgeForm({
            title: "",
            content: "",
            categoryId: "",
          })
          setKnowledgeSummary("")
          setKnowledgeError("")
        }, 2000)
      } else {
        const errorData = await res.json().catch(() => ({}))
        setKnowledgeError(errorData.error || "Nie udało się zapisać do bazy wiedzy. Spróbuj ponownie.")
        setKnowledgeStep("review")
      }
    } catch (error) {
      console.error("Error saving knowledge:", error)
      setKnowledgeError("Wystąpił błąd podczas zapisywania. Sprawdź połączenie z siecią.")
      setKnowledgeStep("review")
    }
  }

  const handleCancelKnowledge = () => {
    setKnowledgeStep("idle")
    setKnowledgeForm({ title: "", content: "", categoryId: "" })
    setKnowledgeSummary("")
    setKnowledgeError("")
  }

  const getQuickPrompts = () => {
    if (mode === "period_goals") {
      return [
        "Zaproponuj długoterminowe cele na okres dla moich kategorii",
        "Jakie strategiczne cele powinienem sobie postawić na kwartał?",
        "Pomóż mi zaplanować cele rozwojowe na najbliższe 3 miesiące",
      ]
    }
    if (mode === "sprint_goals") {
      return [
        "Zaproponuj cele na sprint bazując na moich celach okresu",
        "Jakie cele powinienem sobie postawić?",
        "Pokaż moje obecne cele i zasugeruj ulepszenia",
      ]
    }
    return [
      "Zaproponuj zadania na dziś",
      "Co powinienem dziś zrobić, żeby osiągnąć moje cele?",
      "Zaplanuj mój dzień biorąc pod uwagę cele sprintu",
    ]
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            Asystent AI
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Pomogę Ci zaplanować cele i zadania
          </p>
        </div>
      </div>

      {/* Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as ChatMode)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="daily_tasks" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Zadania na dziś</span>
            <span className="sm:hidden">Dziś</span>
          </TabsTrigger>
          <TabsTrigger value="period_goals" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Cele na okres</span>
            <span className="sm:hidden">Okres</span>
          </TabsTrigger>
          <TabsTrigger value="sprint_goals" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Cele sprintu</span>
            <span className="sm:hidden">Sprint</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={mode} className="flex-1 flex flex-col mt-4">
          {/* Chat Area */}
          <Card className="flex-1 flex flex-col">
            <CardContent className="flex-1 flex flex-col p-3 md:p-4 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>
                      {mode === "sprint_goals"
                        ? "Pomogę Ci zaplanować cele na sprint"
                        : "Pomogę Ci zaplanować zadania na dziś"}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mt-4 max-w-md mx-auto">
                      {getQuickPrompts().map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setInput(prompt)
                            inputRef.current?.focus()
                          }}
                          className="text-xs md:text-sm touch-manipulation"
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>

                      {/* Goals Proposal */}
                      {message.dataType === "goals" && message.data && (
                        <div className="mt-3 space-y-2">
                          {(message.data as GoalProposal[]).map((goal, i) => (
                            <div
                              key={i}
                              className="flex items-start justify-between gap-2 p-2.5 md:p-3 bg-background rounded-lg border hover:border-primary/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm md:text-base break-words">{goal.title}</div>
                                {goal.category && (
                                  <Badge variant="secondary" className="text-[10px] md:text-xs mt-1">
                                    {goal.category}
                                  </Badge>
                                )}
                                {goal.targetValue && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Cel: {goal.targetValue} {goal.unit}
                                  </div>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 flex-shrink-0 touch-manipulation"
                                onClick={() => handleStartAddGoal(goal)}
                                title="Edytuj i dodaj cel"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tasks Proposal */}
                      {message.dataType === "tasks" && message.data && (
                        <div className="mt-3 space-y-2">
                          {(message.data as TaskProposal[]).map((task, i) => (
                            <div
                              key={i}
                              className="flex items-start justify-between gap-2 p-2.5 md:p-3 bg-background rounded-lg border hover:border-primary/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm md:text-base break-words">{task.title}</div>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {task.category && (
                                    <Badge variant="secondary" className="text-[10px] md:text-xs">
                                      {task.category}
                                    </Badge>
                                  )}
                                  {task.plannedMinutes && (
                                    <span className="text-xs text-muted-foreground">
                                      {task.plannedMinutes} min
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 flex-shrink-0 touch-manipulation"
                                onClick={() => handleStartAddTask(task)}
                                title="Edytuj i dodaj zadanie"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing message */}
                {isTyping && typingMessage && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg p-3 flex-1">
                      <p className="whitespace-pre-wrap">
                        {typingMessage}
                        <span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse" />
                      </p>
                    </div>
                  </div>
                )}

                {isLoading && !isTyping && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Knowledge save prompt - appears after conversation */}
              {messages.length > 0 && knowledgeStep === "idle" && (
                <button
                  onClick={handleStartSaveKnowledge}
                  className="w-full p-2 mb-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Chcę zapisać te informacje do bazy wiedzy
                </button>
              )}

              {/* Knowledge generating/review state */}
              {knowledgeStep === "generating" && (
                <div className="mb-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Tworzę podsumowanie rozmowy...
                  </div>
                </div>
              )}

              {knowledgeStep === "review" && (
                <div className="mb-2 p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                  <div className="text-sm font-medium">Proponowane podsumowanie:</div>
                  <Textarea
                    value={knowledgeForm.content}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                    rows={4}
                    className="text-sm"
                  />
                  <div>
                    <Label className="text-xs">Tytuł (opcjonalnie)</Label>
                    <Input
                      value={knowledgeForm.title}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                      placeholder="Automatyczny tytuł..."
                      className="text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Kategoria</Label>
                    <Select
                      value={knowledgeForm.categoryId || "none"}
                      onValueChange={(v) => setKnowledgeForm({ ...knowledgeForm, categoryId: v === "none" ? "" : v })}
                    >
                      <SelectTrigger className="mt-1">
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
                  </div>
                  {knowledgeError && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      {knowledgeError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveKnowledge}
                      disabled={!knowledgeForm.content || !knowledgeForm.categoryId}
                      size="sm"
                      className="flex-1"
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Zapisz do bazy wiedzy
                    </Button>
                    <Button onClick={handleCancelKnowledge} variant="outline" size="sm">
                      Anuluj
                    </Button>
                  </div>
                </div>
              )}

              {knowledgeStep === "saving" && (
                <div className="mb-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Zapisuję do bazy wiedzy...
                  </div>
                </div>
              )}

              {knowledgeStep === "saved" && (
                <div className="mb-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    Zapisano do bazy wiedzy!
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    mode === "period_goals"
                      ? "Zapytaj o cele na okres..."
                      : mode === "sprint_goals"
                      ? "Zapytaj o cele sprintu..."
                      : "Zapytaj o zadania na dziś..."
                  }
                  disabled={isLoading || knowledgeStep !== "idle"}
                  className="text-sm md:text-base"
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim() || knowledgeStep !== "idle"}
                  size="icon"
                  className="flex-shrink-0 touch-manipulation h-10 w-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Goal Dialog */}
      <Dialog open={!!addingGoal} onOpenChange={(open) => !open && setAddingGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "period_goals" ? "Dodaj cel na okres" : "Dodaj cel do sprintu"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Tytuł</Label>
              <Input
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Opis (opcjonalnie)</Label>
              <Input
                value={goalForm.description}
                onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Wartość docelowa</Label>
                <Input
                  type="number"
                  value={goalForm.targetValue}
                  onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })}
                />
              </div>
              <div>
                <Label>Jednostka</Label>
                <Input
                  value={goalForm.unit}
                  onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })}
                  placeholder="np. zadań, godzin"
                />
              </div>
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select
                value={goalForm.categoryId || "none"}
                onValueChange={(v) => setGoalForm({ ...goalForm, categoryId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak kategorii</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === "period_goals" ? (
              <div>
                <Label>Okres</Label>
                <Select
                  value={goalForm.periodId || "none"}
                  onValueChange={(v) => setGoalForm({ ...goalForm, periodId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz okres..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Wybierz okres</SelectItem>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Sprint</Label>
                <Select
                  value={goalForm.sprintId || "none"}
                  onValueChange={(v) => setGoalForm({ ...goalForm, sprintId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz sprint..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Wybierz sprint</SelectItem>
                    {sprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleAddGoal}
              className="w-full"
              disabled={
                !goalForm.title ||
                (mode === "period_goals" ? !goalForm.periodId : !goalForm.sprintId)
              }
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
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select
                value={taskForm.categoryId || "none"}
                onValueChange={(v) => setTaskForm({ ...taskForm, categoryId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak kategorii</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Planowany czas (minuty)</Label>
              <Input
                type="number"
                value={taskForm.plannedMinutes}
                onChange={(e) => setTaskForm({ ...taskForm, plannedMinutes: e.target.value })}
              />
            </div>
            <Button
              onClick={handleAddTask}
              className="w-full"
              disabled={!taskForm.title}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj zadanie
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
