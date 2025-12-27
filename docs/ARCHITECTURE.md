# Zadaniomat AI - Architektura i Plan Rozwoju

## Stack Technologiczny

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + Server Actions
- **Baza danych**: PostgreSQL (Supabase lub Neon) + Prisma ORM
- **Auth**: NextAuth.js (lub Clerk dla szybszego startu)
- **AI**: Google Gemini API
- **Deployment**: Vercel
- **Real-time**: Supabase Realtime (opcjonalnie)

---

## Struktura Modułów (Workspaces)

```
┌─────────────────────────────────────────────────────────────┐
│                      ZADANIOMAT AI                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   WORK MODE     │    │  PRIVATE MODE   │                │
│  │   (Służbowy)    │    │   (Prywatny)    │                │
│  ├─────────────────┤    ├─────────────────┤                │
│  │ • Zadania       │    │ • Habit Tracker │                │
│  │ • Projekty      │    │ • Challenges    │                │
│  │ • Kategorie     │    │ • Wellness      │                │
│  │ • Cele          │    │ • Sport         │                │
│  └────────┬────────┘    └────────┬────────┘                │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      ▼                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SHARED CORE (Wspólne)                   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ • Okresy & Sprinty    • Timer           • AI Engine │   │
│  │ • Statystyki          • Gamifikacja     • Backlog   │   │
│  │ • Kalendarz           • Retrospektywy   • Settings  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Model Danych (Core)

```
User
├── workspaces[] (WORK / PRIVATE)
│
├── Period (Okres)
│   ├── name, startDate, endDate, workspaceType
│   ├── goals[] (Cele okresowe)
│   └── sprints[]
│       ├── name, startDate, endDate
│       ├── goals[] (Cele sprintowe)
│       └── retrospective
│
├── Category
│   ├── name, color, icon, isStrategic
│   └── workspaceType (WORK/PRIVATE/BOTH)
│
├── Task
│   ├── title, description, category, status
│   ├── plannedTime, actualTime
│   ├── scheduledDate, scheduledTime (opcjonalne)
│   ├── isRecurring, recurrenceRule
│   ├── workspaceType
│   └── timeEntries[] (dla timera)
│
├── Habit (tylko PRIVATE)
│   ├── name, frequency, streak
│   └── completions[]
│
├── Challenge (tylko PRIVATE)
│   ├── name, duration, progress
│   └── milestones[]
│
├── Gamification
│   ├── xp, level
│   ├── achievements[]
│   └── rewards[]
│
└── AIConversation
    ├── type (MORNING_ROUTINE, PLANNING, etc.)
    └── messages[]
```

---

## Fazy Rozwoju

### 🚀 FAZA 1: Fundament (MVP) - START TUTAJ
**Cel: Działająca aplikacja z podstawowymi zadaniami**

1. **Setup projektu**
   - Next.js 14 + TypeScript + Tailwind
   - Prisma + PostgreSQL
   - NextAuth.js (logowanie)
   - Podstawowy layout z sidebar

2. **Core Models**
   - User, Workspace (WORK/PRIVATE switch)
   - Period, Sprint
   - Category
   - Task (podstawowe pola)

3. **Podstawowe widoki**
   - Dashboard (dziś)
   - Lista zadań
   - Tworzenie/edycja zadania
   - Przełącznik WORK/PRIVATE

4. **Timer**
   - Start/stop/pause
   - Zapisywanie time entries

---

### 📊 FAZA 2: Planowanie i Organizacja

1. **Okresy i Sprinty**
   - CRUD dla okresów
   - CRUD dla sprintów
   - Widok timeline

2. **Cele**
   - Cele okresowe i sprintowe
   - Powiązanie z kategoriami
   - Progress tracking

3. **Harmonogram dnia**
   - Drag & drop (dnd-kit)
   - Time slots
   - Auto-scheduling dla zadań z godziną

4. **Zadania cykliczne**
   - Recurrence rules (rrule)
   - Auto-generowanie instancji

---

### 📈 FAZA 3: Statystyki i Retrospektywy

1. **Statystyki**
   - Per okres/sprint/dzień
   - Per kategoria
   - Wykresy (Recharts)

2. **Retrospektywy sprintu**
   - Formularz retro
   - Co poszło dobrze/źle
   - Action items

3. **Widok kalendarza**
   - Miesięczny/tygodniowy
   - Integracja z zadaniami

---

### 🤖 FAZA 4: AI Features

1. **AI Engine (bazowy)**
   - Kontekst: cele, statystyki, zadania
   - API endpoint dla konwersacji

2. **Poranna rutyna AI**
   - Przegląd dnia
   - Sugestie priorytetów
   - Rozmowa o planie

3. **AI Planning Assistant**
   - Rozbijanie celów na zadania
   - Sugestie kategoryzacji

---

### 🎮 FAZA 5: Gamifikacja

1. **System XP**
   - Punkty za ukończone zadania
   - Mnożniki za streak

2. **Poziomy i Osiągnięcia**
   - Konfigurowalne osiągnięcia
   - Badges

3. **Rewards System**
   - Własne nagrody
   - Odblokowywanie

---

### 💪 FAZA 6: Habit Tracker & Challenges (Private)

1. **Habit Tracker**
   - Tworzenie habitów
   - Streak tracking
   - Kategorie (wellness, sport, etc.)

2. **Challenges**
   - Wyzwania czasowe
   - Milestones
   - Progress visualization

---

### 👑 FAZA 7: Admin & Advanced

1. **Super Admin Panel**
   - Zarządzanie użytkownikami
   - Globalne ustawienia

2. **Backlog**
   - Quick capture
   - Triage do zadań

3. **Zaawansowane AI**
   - Analiza wzorców
   - Predykcje

---

## Struktura Katalogów

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Sidebar + workspace switch
│   │   ├── page.tsx            # Dashboard (dziś)
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── periods/
│   │   ├── sprints/
│   │   ├── goals/
│   │   ├── stats/
│   │   ├── habits/             # tylko PRIVATE
│   │   ├── challenges/         # tylko PRIVATE
│   │   ├── backlog/
│   │   ├── ai/
│   │   └── settings/
│   ├── admin/                  # Super Admin
│   └── api/
│       ├── auth/
│       ├── tasks/
│       ├── ai/
│       └── ...
├── components/
│   ├── ui/                     # shadcn components
│   ├── tasks/
│   ├── timer/
│   ├── calendar/
│   ├── ai/
│   └── layout/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── ai/
│   │   ├── context-builder.ts  # Buduje kontekst dla AI
│   │   ├── prompts.ts
│   │   └── client.ts
│   └── utils.ts
├── hooks/
│   ├── use-timer.ts
│   ├── use-workspace.ts
│   └── ...
├── stores/                     # Zustand stores
│   ├── workspace-store.ts
│   └── timer-store.ts
└── types/
    └── index.ts
```

---

## Kluczowe Decyzje Architektoniczne

### 1. Workspace jako Context
```typescript
// Każdy request wie w jakim workspace jest
const WorkspaceContext = createContext<'WORK' | 'PRIVATE'>('WORK')

// Hooki automatycznie filtrują dane
const { tasks } = useTasks() // zwraca tylko dla aktywnego workspace
```

### 2. AI Context Builder
```typescript
// AI zawsze ma dostęp do aktualnego kontekstu
interface AIContext {
  currentGoals: Goal[]
  todaysTasks: Task[]
  recentStats: Stats
  currentSprint: Sprint
  streaks: Streak[]
}
```

### 3. Extensible Task System
```typescript
// Zadania mają metadata dla przyszłych rozszerzeń
interface Task {
  // ... core fields
  metadata: Record<string, unknown>  // dla pluginów/rozszerzeń
}
```

### 4. Event-Driven dla Gamifikacji
```typescript
// Eventy pozwalają łatwo dodawać nowe mechaniki
emit('task:completed', { task, timeSpent })
// -> XP system nasłuchuje
// -> Achievement system sprawdza
// -> Stats się aktualizują
```

---

## Co Robimy TERAZ (Faza 1)

1. ✅ Inicjalizacja Next.js + TypeScript + Tailwind
2. ✅ Setup Prisma + schemat bazy (User, Workspace, Task, Category, Period, Sprint)
3. ✅ NextAuth.js (email/password na start)
4. ✅ Layout z sidebar + workspace switcher
5. ✅ CRUD zadań
6. ✅ Timer
7. ✅ Dashboard "Dziś"

**Gotowy do startu?**
