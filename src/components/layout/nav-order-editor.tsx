"use client"

import type { ComponentType } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Check, GripVertical, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface OrderableNavItem {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

// Tabs move only up and down
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

function SortableRow({ item }: { item: OrderableNavItem }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.href,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card pl-3 text-sm font-medium",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary/40"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{item.label}</span>
      {/* Handle only - the list itself still scrolls with a finger */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Przesuń: ${item.label}`}
        className="flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  )
}

interface NavOrderEditorProps {
  items: OrderableNavItem[]
  onChange: (hrefs: string[]) => void
  onDone: () => void
  onReset?: () => void
}

// Side menu tabs dragged into the order the user likes
export function NavOrderEditor({ items, onChange, onDone, onReset }: NavOrderEditorProps) {
  const sensors = useSensors(
    // A small move starts dragging - a tap on the handle does nothing
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const hrefs = items.map((item) => item.href)
    onChange(arrayMove(hrefs, hrefs.indexOf(String(active.id)), hrefs.indexOf(String(over.id))))
  }

  return (
    <div className="space-y-2">
      {/* Stays in view while the list scrolls */}
      <div className="sticky top-0 z-20 -mx-1 space-y-2 bg-card px-1 pb-2">
        <p className="text-xs text-muted-foreground">Przeciągnij za uchwyt, żeby ustawić kolejność zakładek.</p>
        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1" onClick={onDone}>
            <Check className="mr-1.5 h-4 w-4" />
            Gotowe
          </Button>
          {onReset && (
            <Button size="sm" variant="ghost" onClick={onReset} title="Przywróć domyślną kolejność">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Domyślna
            </Button>
          )}
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((item) => item.href)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {items.map((item) => (
              <SortableRow key={item.href} item={item} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
