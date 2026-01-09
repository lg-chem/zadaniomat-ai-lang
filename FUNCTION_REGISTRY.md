# 📘 Rejestr Funkcji - Zadaniomat AI

> **Single Source of Truth** dla wszystkich kluczowych funkcji, hooków i modułów w projekcie.
> Aktualizuj ten dokument przy każdej istotnej zmianie w logice aplikacji!

---

## 📋 Spis Treści

1. [Hooks (Custom React Hooks)](#-hooks-custom-react-hooks)
2. [Zustand Stores](#-zustand-stores)
3. [Utility Functions (lib/)](#-utility-functions-lib)
4. [API Endpoints](#-api-endpoints)
5. [Komponenty UI](#-komponenty-ui)
6. [Typy i Interfejsy](#-typy-i-interfejsy)
7. [Checklista zmian](#-checklista-zmian)

---

## 🪝 Hooks (Custom React Hooks)

### `useTasks`
**Lokalizacja:** `src/hooks/use-tasks.ts`

**Zależności:**
- `useSWR` - fetching z cache
- `useWorkspaceStore` - pobiera aktualny workspace

**Logika:**
- Pobiera zadania z API `/api/tasks` z filtrowaniem po dacie i workspace
- Implementuje optimistic updates (`optimisticUpdate`, `optimisticDelete`, `optimisticAdd`)
- Automatycznie rollbackuje w przypadku błędu serwera

**Gdzie użyte:**
- `/src/app/(dashboard)/tasks/page.tsx` - lista zadań
- `/src/app/(dashboard)/today/page.tsx` - widok dzisiejszy
- `/src/components/tasks/*` - komponenty zadań

**API:**
```typescript
const { tasks, isLoading, isError, mutate, optimisticUpdate, optimisticDelete, optimisticAdd } = useTasks({
  date?: string,      // Format: 'YYYY-MM-DD'
  from?: string,      // Zakres od
  to?: string,        // Zakres do
  includeAssigned?: boolean  // Czy uwzględnić przypisane zadania
})
```

---

### `useCategories`
**Lokalizacja:** `src/hooks/use-categories.ts`

**Zależności:**
- `useSWR`
- `useWorkspaceStore`

**Logika:**
- Pobiera kategorie z `/api/categories` filtrowane po workspace
- Cache'owane przez SWR

**Gdzie użyte:**
- Formularze tworzenia/edycji zadań
- Filtry w widoku zadań
- Panel kategorii

**API:**
```typescript
interface Category {
  id: string
  name: string
  color: string
  icon?: string
  isStrategic: boolean
  order: number
}

const { categories, isLoading, isError, mutate } = useCategories()
```

---

### `useHabits`
**Lokalizacja:** `src/hooks/use-habits.ts`

**Zależności:**
- `useSWR`
- `useWorkspaceStore`

**Logika:**
- Pobiera nawyki TYLKO dla workspace `PRIVATE`
- Zawiera completions (ukończenia) w jednym zapytaniu
- Zwraca `null` dla innych workspace'ów

**Gdzie użyte:**
- `/src/app/(dashboard)/habits/page.tsx`
- Komponenty nawyków

**API:**
```typescript
interface Habit {
  id: string
  name: string
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  targetCount: number
  currentStreak: number
  completions: HabitCompletion[]
}

const { habits, isLoading, isError, mutate } = useHabits()
```

---

### `useSprints`
**Lokalizacja:** `src/hooks/use-sprints.ts`

**Zależności:**
- `useSWR`
- `useWorkspaceStore`

**Logika:**
- Pobiera sprinty dla aktualnego workspace
- Używane w planowaniu sprintów

**Gdzie użyte:**
- Panel sprintów
- Przypisywanie zadań do sprintów

---

### `useGoals`
**Lokalizacja:** `src/hooks/use-goals.ts`

**Zależności:**
- `useSWR`
- `useWorkspaceStore`

**Logika:**
- Pobiera cele z opcjonalnym filtrowaniem po `sprintId` i `periodId`

**Gdzie użyte:**
- Panel celów
- Formularz przypisywania zadań do celów

---

### `useChallenges` / `useGroupChallenges`
**Lokalizacja:** `src/hooks/use-challenges.ts`, `src/hooks/use-group-challenges.ts`

**Zależności:**
- `useSWR`

**Logika:**
- `useChallenges` - osobiste wyzwania użytkownika
- `useGroupChallenges` - wyzwania zespołowe

**Gdzie użyte:**
- Panel wyzwań
- Gamifikacja

---

### `useScheduleBlocks`
**Lokalizacja:** `src/hooks/use-schedule-blocks.ts`

**Zależności:**
- `useSWR`
- `useWorkspaceStore`

**Logika:**
- Pobiera bloki czasowe harmonogramu
- Używane w planowaniu tygodniowym

**Gdzie użyte:**
- Widok kalendarza/harmonogramu
- Time blocking

---

### `useOverdueTasks`
**Lokalizacja:** `src/hooks/use-overdue-tasks.ts`

**Zależności:**
- `useSWR`
- `useWorkspaceStore`

**Logika:**
- Pobiera zadania przeterminowane (scheduledDate < today, status != COMPLETED)

**Gdzie użyte:**
- Powiadomienia o przeterminowanych zadaniach
- Dashboard

---

### `useBacklog`
**Lokalizacja:** `src/hooks/use-backlog.ts`

**Zależności:**
- `useSWR`
- `useWorkspaceStore`

**Logika:**
- Pobiera elementy backlogu (zadania bez daty)

**Gdzie użyte:**
- Widok backlogu
- Dyskusja z AI o backlogu

---

### `useTaskCounts`
**Lokalizacja:** `src/hooks/use-task-counts.ts`

**Zależności:**
- `useSWR`
- `useWorkspaceStore`

**Logika:**
- Pobiera zliczenia zadań (do statystyk)

**Gdzie użyte:**
- Dashboard, statystyki

---

### `useSport`
**Lokalizacja:** `src/hooks/use-sport.ts`

**Logika:**
- Pobiera dane sportowe/fitness użytkownika

**Gdzie użyte:**
- Panel fitness

---

### `usePrefetch`
**Lokalizacja:** `src/hooks/use-prefetch.ts`

**Logika:**
- Prefetch danych dla lepszego UX (pre-ładowanie w tle)

**Gdzie użyte:**
- Layout główny, nawigacja

---

### `useData` (DEPRECATED - do usunięcia)
**Lokalizacja:** `src/hooks/use-data.ts`

**UWAGA:** Ten plik zawiera duplikaty funkcji z innych hooków. Używaj dedykowanych hooków zamiast tego pliku!

---

## 🏪 Zustand Stores

### `useWorkspaceStore`
**Lokalizacja:** `src/stores/workspace-store.ts`

**Stan:**
```typescript
type WorkspaceType = 'FRIENDS' | 'WORK' | 'PRIVATE'

interface WorkspaceState {
  workspace: WorkspaceType
  setWorkspace: (workspace: WorkspaceType) => void
}
```

**Logika:**
- Przechowuje aktualny workspace użytkownika
- Persystowany w localStorage (`zadaniomat-workspace`)
- **KLUCZOWE:** Wszystkie hooki używają tego store do filtrowania danych!

**Gdzie użyte:**
- Globalnie w całej aplikacji
- Przełącznik workspace w headerze/sidebar
- Wszystkie hooki danych (useTasks, useCategories, etc.)

---

### `useTimerStore`
**Lokalizacja:** `src/stores/timer-store.ts`

**Stan:**
```typescript
interface TimerState {
  isRunning: boolean
  isPaused: boolean
  isMinimized: boolean
  taskId: string | null
  taskTitle: string | null
  mode: 'countdown' | 'stopwatch'
  plannedSeconds: number
  elapsedSeconds: number
  remainingSeconds: number
  // ... więcej pól
}
```

**Akcje:**
- `startTimer(taskId, taskTitle, plannedMinutes?, alreadyWorkedMinutes?)` - rozpoczyna timer
- `pauseTimer()` - pauzuje
- `resumeTimer()` - wznawia
- `stopTimer()` - zatrzymuje i zwraca `{ taskId, durationSeconds }`
- `completeTask()` - kończy zadanie i czyści stan
- `extendTimer(minutes)` - przedłuża czas
- `tick()` - aktualizacja co sekundę (wywoływana przez setInterval)

**Logika:**
- Obsługuje countdown (planowany czas) i stopwatch (bez limitu)
- Powiadomienia przeglądarki gdy czas minie
- Persystowany w localStorage (`timer-storage`)
- Zapamiętuje stan dla każdego zadania (można wznowić)

**Gdzie użyte:**
- Floating timer widget
- Karty zadań (przycisk start timera)
- Panel zadania

**Helper functions:**
- `formatTime(seconds)` - formatuje sekundy do `MM:SS` lub `HH:MM:SS`
- `formatMinutes(minutes)` - formatuje minuty do `Xh Ymin`
- `useTimerHydration()` - hook sprawdzający hydratację (SSR)

---

### `useRecentFriendsStore`
**Lokalizacja:** `src/stores/recent-friends-store.ts`

**Logika:**
- Przechowuje ostatnio wybrane osoby do przypisania zadań
- Optymalizacja UX - szybszy wybór

---

## 🛠 Utility Functions (lib/)

### `cn(...inputs)`
**Lokalizacja:** `src/lib/utils.ts`

**Logika:**
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Gdzie użyte:**
- Wszędzie gdzie łączymy klasy Tailwind
- Komponenty Shadcn/UI

---

### `fetcher` + `swrConfig`
**Lokalizacja:** `src/lib/swr-config.ts`

**Logika:**
```typescript
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('...')
  return res.json()
}

export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  dedupingInterval: 5000,
  errorRetryCount: 2,
  keepPreviousData: true,
  // ...
}
```

**Gdzie użyte:**
- Provider SWR w głównym layout
- Wszystkie hooki SWR

---

### `prisma`
**Lokalizacja:** `src/lib/prisma.ts`

**Logika:**
- Singleton instancji Prisma Client
- Używa globalThis dla hot-reload w dev

**Gdzie użyte:**
- Wszystkie API routes

---

### `auth` (NextAuth config)
**Lokalizacja:** `src/lib/auth.ts`

**Logika:**
- Konfiguracja NextAuth z CredentialsProvider
- JWT sessions
- Callbacks dla rozszerzenia sesji (userId, role, isApproved)

**Gdzie użyte:**
- `/api/auth/[...nextauth]/route.ts`
- `getServerSession()` w API routes

---

### `gemini`
**Lokalizacja:** `src/lib/gemini.ts`

**Logika:**
- Konfiguracja Google Gemini API
- Helper functions dla AI

**Gdzie użyte:**
- API routes AI (`/api/ai/*`)

---

### `ai-prompts`
**Lokalizacja:** `src/lib/ai-prompts.ts`

**Logika:**
- Szablony promptów dla AI
- Różne typy konwersacji (MORNING_ROUTINE, PLANNING, etc.)

**Gdzie użyte:**
- Funkcje AI w aplikacji

---

## 🔌 API Endpoints

### Tasks
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/tasks` | GET | Lista zadań (filtry: date, from, to, workspace) |
| `/api/tasks` | POST | Tworzenie zadania |
| `/api/tasks/[id]` | GET | Szczegóły zadania |
| `/api/tasks/[id]` | PATCH | Aktualizacja zadania |
| `/api/tasks/[id]` | DELETE | Usunięcie zadania |
| `/api/tasks/[id]/time` | POST | Dodanie czasu pracy |
| `/api/tasks/[id]/subtasks` | GET/POST | Podzadania |
| `/api/tasks/reorder` | POST | Zmiana kolejności |

### Goals
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/goals` | GET/POST | Lista/tworzenie celów |
| `/api/goals/[id]` | GET/PATCH/DELETE | CRUD celu |

### Habits
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/habits` | GET/POST | Lista/tworzenie nawyków |
| `/api/habits/[id]` | PATCH/DELETE | Edycja/usuwanie |
| `/api/habits/[id]/complete` | POST | Oznacz ukończenie |

### Categories
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/categories` | GET/POST | Lista/tworzenie kategorii |
| `/api/categories/[id]` | PATCH/DELETE | Edycja/usuwanie |

### Sprints & Periods
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/sprints` | GET/POST | Sprinty |
| `/api/periods` | GET/POST | Okresy |

### Organizations (Teams)
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/organizations` | GET/POST | Organizacje |
| `/api/organizations/[id]/members` | GET/POST | Członkowie |
| `/api/organizations/[id]/tasks` | GET | Zadania zespołu |

### AI
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/ai/conversations` | GET/POST | Konwersacje AI |
| `/api/ai/conversations/[id]/messages` | POST | Wiadomość do AI |
| `/api/ai/settings` | GET/PATCH | Ustawienia AI |

### Sport/Fitness
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/sport/activities` | GET/POST | Aktywności |
| `/api/sport/steps` | GET/POST | Kroki |

---

## 🎨 Komponenty UI

### Shadcn/UI Base (`src/components/ui/`)
- `Button` - przyciski (warianty: default, destructive, outline, ghost, link)
- `Card` - karty (CardHeader, CardContent, CardFooter)
- `Dialog` - modale
- `Input`, `Textarea`, `Label` - formularze
- `Select` - selecty (Radix)
- `Tabs` - zakładki
- `Badge` - etykiety
- `Skeleton` - loading states
- `Toast` - powiadomienia
- `Tooltip` - podpowiedzi
- `Avatar` - awatary
- `Calendar` - kalendarz (react-day-picker)
- `Popover` - popovery
- `DropdownMenu` - menu rozwijane
- `Progress` - paski postępu
- `Checkbox` - checkboxy
- `ScrollArea` - przewijalne obszary
- `Sheet` - panele boczne
- `Alert` - alerty

### Custom Components
- `src/components/tasks/` - komponenty zadań
- `src/components/layout/` - layouty, sidebar, header
- `src/components/teams/` - komponenty zespołowe
- `src/components/schedule/` - harmonogram
- `src/components/sprints/` - sprinty

---

## 📦 Typy i Interfejsy

### Główne typy (`prisma/schema.prisma` + `src/types/`)

```typescript
// Workspace
type WorkspaceType = 'FRIENDS' | 'WORK' | 'PRIVATE'

// Task Status
type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'TO_TRANSFER'

// User Roles
type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

// AI Conversation Types
type AIConversationType = 'MORNING_ROUTINE' | 'PLANNING' | 'RETROSPECTIVE' | 'GENERAL' | 'BACKLOG_DISCUSSION'

// Habit Frequency
type HabitFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'
```

---

## 🔔 System Powiadomień (Toast)

### Konfiguracja
**Biblioteka:** `sonner`
**Lokalizacja Toastera:** `src/app/layout.tsx`

```typescript
import { Toaster } from "sonner"

<Toaster
  position="top-center"
  richColors
  closeButton
  toastOptions={{
    duration: 4000,
    className: "font-sans",
  }}
/>
```

### Użycie
```typescript
import { toast } from "sonner"

// Sukces
toast.success("Operacja zakończona pomyślnie")

// Błąd
toast.error("Wystąpił błąd")

// Informacja
toast.info("Informacja dla użytkownika")

// Ładowanie
toast.loading("Przetwarzanie...")
```

### Gdzie użyte
- `/src/app/(dashboard)/backlog/page.tsx` - operacje CRUD backlogu
- `/src/app/(dashboard)/goals/page.tsx` - operacje na celach
- `/src/app/(dashboard)/habits/page.tsx` - operacje na nawykach

**WAŻNE:** Każda operacja CRUD powinna pokazywać toast sukcesu lub błędu!

---

## ⚡ Lazy Loading

### Komponenty z lazy loading
**Lokalizacja:** `src/app/(dashboard)/layout.tsx`

```typescript
import dynamic from "next/dynamic"

// Lazy load heavy components
const PWAInstallPrompt = dynamic(
  () => import("@/components/pwa-install-prompt").then((mod) => mod.PWAInstallPrompt),
  { ssr: false }
)

const FloatingChat = dynamic(
  () => import("@/components/chat/floating-chat").then((mod) => mod.FloatingChat),
  { ssr: false }
)
```

### Kiedy używać lazy loading
- Komponenty które nie są widoczne od razu (modals, floating elements)
- Ciężkie komponenty (wykresy, edytory)
- Komponenty wymagające window/document (PWA, notifications)

---

## ✅ Checklista zmian

Przed wprowadzeniem zmian w którymkolwiek z powyższych modułów:

1. **Przeszukaj cały projekt** - `grep -r "nazwaFunkcji"` lub wyszukaj w IDE
2. **Sprawdź ten dokument** - sekcja "Gdzie użyte"
3. **Zaktualizuj wszędzie** - nie zostawiaj starych wersji
4. **Zaktualizuj ten dokument** - dodaj nowe lokalizacje użycia
5. **Przetestuj** - upewnij się, że wszystko działa

### Typowe błędy do unikania:
- ❌ Duplikowanie hooków (use-data.ts vs dedykowane hooki)
- ❌ Hardcodowanie workspace zamiast używania `useWorkspaceStore`
- ❌ Pomijanie optimistic updates w mutacjach
- ❌ Brak error handling w API calls
- ❌ Używanie `any` w TypeScript

---

## 📝 Historia zmian rejestru

| Data | Zmiana | Autor |
|------|--------|-------|
| 2026-01-09 | Dodano system toastów (sonner), lazy loading, A11y | Claude |
| 2026-01-09 | Utworzenie dokumentu | Claude |

---

> **Pamiętaj:** Ten dokument to żywy rejestr. Aktualizuj go przy każdej istotnej zmianie w kodzie!
