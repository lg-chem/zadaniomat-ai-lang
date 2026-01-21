"use client"

import { useState } from "react"
import {
  BookOpen,
  Folder,
  FileText,
  Users,
  Settings,
  Code,
  Database,
  Globe,
  Mail,
  Phone,
  Calendar,
  Clock,
  Star,
  Heart,
  Flag,
  AlertCircle,
  CheckCircle,
  Info,
  HelpCircle,
  Zap,
  Briefcase,
  Building,
  ShoppingCart,
  CreditCard,
  DollarSign,
  BarChart,
  PieChart,
  TrendingUp,
  Target,
  Award,
  Lightbulb,
  MessageSquare,
  Image,
  Video,
  Music,
  MapPin,
  Truck,
  Package,
  Shield,
  Lock,
  Key,
  Wrench,
  Cpu,
  Layers,
  Layout,
  Grid,
  List,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Map of icon names to components
export const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Folder,
  FileText,
  Users,
  Settings,
  Code,
  Database,
  Globe,
  Mail,
  Phone,
  Calendar,
  Clock,
  Star,
  Heart,
  Flag,
  AlertCircle,
  CheckCircle,
  Info,
  HelpCircle,
  Zap,
  Briefcase,
  Building,
  ShoppingCart,
  CreditCard,
  DollarSign,
  BarChart,
  PieChart,
  TrendingUp,
  Target,
  Award,
  Lightbulb,
  MessageSquare,
  Image,
  Video,
  Music,
  MapPin,
  Truck,
  Package,
  Shield,
  Lock,
  Key,
  Wrench,
  Cpu,
  Layers,
  Layout,
  Grid,
  List,
}

export const ICON_NAMES = Object.keys(ICON_MAP)

interface IconPickerProps {
  value?: string | null
  onChange: (icon: string) => void
  className?: string
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const SelectedIcon = value ? ICON_MAP[value] : Folder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-10 w-10 p-0", className)}
          title="Wybierz ikonę"
        >
          {SelectedIcon && <SelectedIcon className="h-5 w-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {ICON_NAMES.map((iconName) => {
            const Icon = ICON_MAP[iconName]
            const isSelected = value === iconName
            return (
              <Button
                key={iconName}
                variant={isSelected ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  onChange(iconName)
                  setOpen(false)
                }}
                title={iconName}
              >
                <Icon className="h-4 w-4" />
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Helper component to render icon by name
interface DynamicIconProps {
  name?: string | null
  className?: string
  style?: React.CSSProperties
  fallback?: LucideIcon
}

export function DynamicIcon({ name, className, style, fallback: Fallback = Folder }: DynamicIconProps) {
  const Icon = name ? ICON_MAP[name] : Fallback
  if (!Icon) return <Fallback className={className} style={style} />
  return <Icon className={className} style={style} />
}
