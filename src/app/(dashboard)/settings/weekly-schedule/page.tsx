"use client"

import { useState, useCallback, KeyboardEvent } from "react"
import {
  Plus,
  Trash2,
  Check,
  Calendar,
  ChevronLeft,
  Copy,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useScheduleBlocks, ScheduleBlock } from "@/hooks/use-schedule-blocks"
import Link from "next/link"

const DAYS_OF_WEEK = [
  { value: 0, label: "Poniedziałek", short: "Pon" },
  { value: 1, label: "Wtorek", short: "Wt" },
  { value: 2, label: "Środa", short: "Śr" },
  { value: 3, label: "Czwartek", short: "Czw" },
  { value: 4, label: "Piątek", short: "Pt" },
  { value: 5, label: "Sobota", short: "Sob" },
  { value: 6, label: "Niedziela", short: "Nd" },
]

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#6366f1",
  "#84cc16",
  "#f97316",
]

export default function WeeklySchedulePage() {
  const { workspace } = useWorkspaceStore()
  const { blocks, isLoading, mutate, optimisticAdd, optimisticDelete } =
    useScheduleBlocks()

  const [selectedDay, setSelectedDay] = useState<number>(0)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newBlock, setNewBlock] = useState({
    name: "",
    startTime: "09:00",
    endTime: "10:00",
    color: COLORS[0],
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<ScheduleBlock>>({})

  // Filter blocks for selected day
  const dayBlocks = blocks.filter((b) => b.dayOfWeek === selectedDay)

  // Count blocks per day for badges
  const blockCountByDay = DAYS_OF_WEEK.map(
    (day) => blocks.filter((b) => b.dayOfWeek === day.value).length
  )

  const handleCreateBlock = async () => {
    if (!newBlock.name.trim()) return

    await optimisticAdd(
      {
        name: newBlock.name,
        dayOfWeek: selectedDay,
        startTime: newBlock.startTime,
        endTime: newBlock.endTime,
        color: newBlock.color,
        order: dayBlocks.length,
      },
      async () => {
        const res = await fetch("/api/schedule-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newBlock.name,
            dayOfWeek: selectedDay,
            startTime: newBlock.startTime,
            endTime: newBlock.endTime,
            color: newBlock.color,
            workspaceType: workspace,
            order: dayBlocks.length,
          }),
        })
        return res.json()
      }
    )

    setNewBlock({ name: "", startTime: "09:00", endTime: "10:00", color: COLORS[0] })
    setIsAddingNew(false)
  }

  const handleDeleteBlock = async (blockId: string) => {
    await optimisticDelete(blockId, async () => {
      await fetch(`/api/schedule-blocks/${blockId}`, { method: "DELETE" })
    })
  }

  const handleStartEdit = (block: ScheduleBlock) => {
    setEditingId(block.id)
    setEditingData({
      name: block.name,
      startTime: block.startTime,
      endTime: block.endTime,
      color: block.color,
    })
  }

  const handleSaveEdit = async (blockId: string) => {
    if (!editingData.name?.trim()) {
      setEditingId(null)
      return
    }

    try {
      await fetch(`/api/schedule-blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingData),
      })
      mutate()
    } catch (error) {
      console.error("Error updating block:", error)
    }
    setEditingId(null)
  }

  const handleCopyToOtherDays = async (block: ScheduleBlock) => {
    const otherDays = DAYS_OF_WEEK.filter((d) => d.value !== selectedDay)
    const confirmed = confirm(
      `Skopiować blok "${block.name}" do pozostałych dni tygodnia?`
    )
    if (!confirmed) return

    for (const day of otherDays) {
      await fetch("/api/schedule-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: block.name,
          description: block.description,
          dayOfWeek: day.value,
          startTime: block.startTime,
          endTime: block.endTime,
          color: block.color,
          workspaceType: workspace,
          order: 0,
        }),
      })
    }
    mutate()
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, action: () => void) => {
      if (e.key === "Enter") {
        e.preventDefault()
        action()
      }
      if (e.key === "Escape") {
        setEditingId(null)
        setIsAddingNew(false)
      }
    },
    []
  )

  const formatTime = (time: string) => time

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Harmonogram tygodniowy
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Ustaw typowe bloki dla każdego dnia tygodnia ({workspace === "WORK" ? "Praca" : "Prywatne"})
          </p>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {DAYS_OF_WEEK.map((day) => (
          <Button
            key={day.value}
            variant={selectedDay === day.value ? "default" : "outline"}
            className="flex-shrink-0 relative"
            onClick={() => setSelectedDay(day.value)}
          >
            <span className="hidden sm:inline">{day.label}</span>
            <span className="sm:hidden">{day.short}</span>
            {blockCountByDay[day.value] > 0 && (
              <Badge
                variant="secondary"
                className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
              >
                {blockCountByDay[day.value]}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Blocks for Selected Day */}
      <Card>
        <CardHeader>
          <CardTitle>{DAYS_OF_WEEK[selectedDay].label}</CardTitle>
          <CardDescription>
            Bloki czasowe dla tego dnia. Kliknij aby edytować.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Ładowanie...</p>
          ) : (
            <div className="space-y-2">
              {/* Existing Blocks */}
              {dayBlocks
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((block) => (
                  <div
                    key={block.id}
                    className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                    style={{ borderLeftColor: block.color, borderLeftWidth: 4 }}
                  >
                    {editingId === block.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingData.name || ""}
                          onChange={(e) =>
                            setEditingData({ ...editingData, name: e.target.value })
                          }
                          onKeyDown={(e) =>
                            handleKeyDown(e, () => handleSaveEdit(block.id))
                          }
                          placeholder="Nazwa bloku"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground">Od</label>
                            <Input
                              type="time"
                              value={editingData.startTime || ""}
                              onChange={(e) =>
                                setEditingData({
                                  ...editingData,
                                  startTime: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground">Do</label>
                            <Input
                              type="time"
                              value={editingData.endTime || ""}
                              onChange={(e) =>
                                setEditingData({
                                  ...editingData,
                                  endTime: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`h-6 w-6 rounded-full border-2 transition-all ${
                                editingData.color === color
                                  ? "border-foreground scale-110"
                                  : "border-transparent hover:scale-105"
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() =>
                                setEditingData({ ...editingData, color })
                              }
                            />
                          ))}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Anuluj
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(block.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Zapisz
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => handleStartEdit(block)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: block.color }}
                          />
                          <div>
                            <div className="font-medium">{block.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(block.startTime)} -{" "}
                              {formatTime(block.endTime)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyToOtherDays(block)
                            }}
                            title="Kopiuj do innych dni"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteBlock(block.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {/* Empty State */}
              {dayBlocks.length === 0 && !isAddingNew && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Brak bloków dla tego dnia</p>
                  <p className="text-sm">Dodaj pierwszy blok aby zacząć</p>
                </div>
              )}

              {/* Add New Block */}
              {isAddingNew ? (
                <div className="border rounded-lg p-3 bg-primary/5 space-y-2">
                  <Input
                    placeholder="Nazwa bloku (np. Deep Work, Spotkania, Przerwa)"
                    value={newBlock.name}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, name: e.target.value })
                    }
                    onKeyDown={(e) => handleKeyDown(e, handleCreateBlock)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Od</label>
                      <Input
                        type="time"
                        value={newBlock.startTime}
                        onChange={(e) =>
                          setNewBlock({ ...newBlock, startTime: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Do</label>
                      <Input
                        type="time"
                        value={newBlock.endTime}
                        onChange={(e) =>
                          setNewBlock({ ...newBlock, endTime: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-6 w-6 rounded-full border-2 transition-all ${
                          newBlock.color === color
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewBlock({ ...newBlock, color })}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddingNew(false)}
                    >
                      Anuluj
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateBlock}
                      disabled={!newBlock.name.trim()}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Dodaj
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAddingNew(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj blok
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Wskazówki:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Bloki to szablony - definiujesz tu typowy dzień, a potem możesz go
                modyfikować dla konkretnej daty
              </li>
              <li>
                Użyj przycisku kopiowania, aby szybko powielić blok do innych dni
              </li>
              <li>
                W widoku harmonogramu zobaczysz te bloki i będziesz mógł je
                edytować tylko dla tego dnia
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
