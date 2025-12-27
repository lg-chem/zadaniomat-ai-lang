# Performance Optimization Guide

## ZASADY OBOWIĄZKOWE - ZAWSZE STOSUJ! ⚡

Każda nowa funkcja/strona MUSI być napisana z myślą o wydajności od samego początku.

---

## 1. DATA FETCHING - Zawsze używaj SWR

### ❌ NIE RÓB TAK:
```typescript
const [data, setData] = useState([])
const [isLoading, setIsLoading] = useState(true)

useEffect(() => {
  fetch('/api/tasks').then(r => r.json()).then(setData)
}, [])
```

**Problemy:**
- Każde przejście na stronę = nowe zapytanie do bazy
- Brak cache'owania
- Wolne przełączanie między zakładkami

### ✅ RÓB TAK:
```typescript
// 1. Stwórz hook w src/hooks/use-*.ts
import useSWR from 'swr'

export function useTasks() {
  const { data, error, isLoading, mutate } = useSWR<Task[]>('/api/tasks')
  return {
    tasks: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}

// 2. Użyj w komponencie
const { tasks, isLoading, mutate } = useTasks()
```

**Korzyści:**
- ⚡ Instant loading z cache (5 min)
- 🔄 Automatyczna revalidacja
- 📦 Deduplikacja requestów
- 🎯 Optimistic updates

---

## 2. REACT OPTIMIZATIONS - Zapobiegaj re-renderom

### useCallback dla funkcji w komponentach

❌ **NIE:**
```typescript
const handleClick = async () => {
  await doSomething()
}
// Tworzy nową funkcję przy każdym renderze!
```

✅ **TAK:**
```typescript
const handleClick = useCallback(async () => {
  await doSomething()
}, [dependencies])
// Funkcja tworzona raz i cache'owana
```

### useMemo dla kosztownych operacji

❌ **NIE:**
```typescript
const filtered = items.filter(complex=> Logic).map(transform)
// Wykonywane przy każdym renderze!
```

✅ **TAK:**
```typescript
const filtered = useMemo(() =>
  items.filter(complexLogic).map(transform),
[items])
```

### React.memo dla komponentów

✅ **Używaj dla:**
- Dużych list
- Komponentów które re-renderują się często
- Komponentów z kosztownymi obliczeniami

```typescript
export const ExpensiveComponent = memo(({ data }: Props) => {
  // ...
})
```

---

## 3. NEXT.JS OPTIMIZATIONS

### Prefetching - Wyłącz domyślny

❌ **NIE:**
```typescript
<Link href="/page">Page</Link>
// Prefetchuje wszystkie linki = wolne ładowanie!
```

✅ **TAK:**
```typescript
<Link href="/page" prefetch={false}>Page</Link>
// Ładuje dopiero po kliknięciu = szybkie ładowanie!
```

### Optimized Imports

✅ **W next.config.mjs:**
```javascript
experimental: {
  optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
}

modularizeImports: {
  'lucide-react': {
    transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
  },
}
```

---

## 4. MUTATIONS - Po zapisie odśwież dane

### ❌ NIE RÓB TAK:
```typescript
await fetch('/api/tasks', { method: 'POST', body: ... })
// Dane nieaktualne!
```

### ✅ RÓB TAK:
```typescript
const { mutate } = useTasks()

await fetch('/api/tasks', { method: 'POST', body: ... })
mutate() // SWR automatycznie odświeży dane z cache
```

### Optimistic Updates (zaawansowane)
```typescript
mutate(
  optimisticData,  // Pokaż natychmiast
  {
    optimisticData,
    rollbackOnError: true,
    populateCache: true,
    revalidate: false,
  }
)
```

---

## 5. DATABASE QUERIES - Indeksy są kluczowe

### Sprawdź schema Prisma - każda tabela MUSI mieć indeksy

✅ **Przykład:**
```prisma
model Task {
  id            String   @id
  userId        String
  scheduledDate DateTime?

  @@index([userId, scheduledDate])  // ✅ Szybkie query
  @@index([userId, workspaceType])  // ✅ Filtrowanie
}
```

❌ **Bez indeksów:**
- Wolne zapytania
- Full table scan
- Timeout przy dużych danych

---

## 6. API ROUTES - Optymalizuj zapytania

### N+1 Problem - Używaj `include`

❌ **NIE:**
```typescript
const tasks = await prisma.task.findMany()
for (const task of tasks) {
  task.category = await prisma.category.findUnique({ where: { id: task.categoryId }})
}
// N+1 queries = BARDZO WOLNE!
```

✅ **TAK:**
```typescript
const tasks = await prisma.task.findMany({
  include: { category: true }  // 1 query = SZYBKO!
})
```

---

## 7. KOMPONENTY - Lazy Loading

### Dynamic imports dla ciężkich komponentów

✅ **Dla komponentów używanych rzadko:**
```typescript
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <Skeleton />,
  ssr: false  // Jeśli nie potrzeba SSR
})
```

---

## 8. IMAGES - Zawsze używaj next/image

❌ **NIE:**
```html
<img src="/image.png" />
```

✅ **TAK:**
```typescript
import Image from 'next/image'

<Image
  src="/image.png"
  alt="Description"
  width={500}
  height={300}
  priority={isAboveFold}  // Dla above-the-fold
/>
```

---

## 9. SWR CONFIG - Globalne ustawienia

### src/lib/swr-config.ts
```typescript
export const swrConfig: SWRConfiguration = {
  // Revalidate on focus - FALSE (oszczędza requesty)
  revalidateOnFocus: false,

  // Revalidate on reconnect - TRUE
  revalidateOnReconnect: true,

  // Dedupe w 2s
  dedupingInterval: 2000,

  // Keep previous data podczas revalidation
  keepPreviousData: true,

  // Retry 2x przy błędach
  errorRetryCount: 2,
}
```

---

## 10. MONITORING - Sprawdzaj wydajność

### React DevTools Profiler
```bash
npm run dev
# Otwórz React DevTools -> Profiler
# Nagraj sesję i sprawdź które komponenty re-renderują się za często
```

### Next.js Speed Insights
```typescript
// next.config.js
experimental: {
  instrumentationHook: true,
}
```

### Browser Performance
```javascript
// Mierz czas operacji
console.time('operation')
// ... kod ...
console.timeEnd('operation')
```

---

## CHECKLIST dla nowych feature'ów ✅

Przed mergem każdej nowej funkcji sprawdź:

- [ ] Używam SWR dla wszystkich data fetching?
- [ ] Wszystkie `Link` mają `prefetch={false}`?
- [ ] Używam `useCallback` dla event handlerów?
- [ ] Używam `useMemo` dla kosztownych kalkulacji?
- [ ] API routes używają `include` zamiast N+1?
- [ ] Wszystkie query mają odpowiednie indeksy w Prisma?
- [ ] Po mutations wywołuję `mutate()`?
- [ ] Komponenty nie mają zbędnych re-renderów?

---

## PRZYKŁADY Z PROJEKTU

### ✅ Backlog Page (DOBRY PRZYKŁAD)
```typescript
// Używa SWR hooka
const { items, isLoading, mutate } = useBacklog({ showProcessed })

// Po zapisie - mutate
await fetch('/api/backlog', { method: 'POST', ... })
mutate()
```

### ✅ Schedule Page (DOBRY PRZYKŁAD)
```typescript
// SWR dla tasks, categories, sprints
const { tasks, mutate: mutateTasks } = useTasks({ date })
const { categories } = useCategories()
const { activeSprint } = useSprints()

// Wszystkie operacje używają mutate
await fetch('/api/tasks', { method: 'POST', ... })
mutateTasks()
```

---

## METRYKI SUKCESU 🎯

### Przed optymalizacją:
- ⏱️ Przejście między zakładkami: 1-2 sekundy
- 🐌 Każde kliknięcie = zapytanie do bazy
- 💾 Brak cache'owania

### Po optymalizacji:
- ⚡ Przejście między zakładkami: **INSTANT** (< 100ms)
- 🚀 Cache'owane dane przez 5 minut
- 📦 Deduplikacja requestów
- 🎯 50-90% mniej zapytań do bazy

---

## KIEDY NIE UŻYWAĆ CACHE?

### SWR NIE jest dobry dla:
- ❌ Real-time data (użyj WebSockets)
- ❌ Dane które się zmieniają co sekundę
- ❌ Dane wrażliwe które wymagają zawsze fresh fetch

### W tych przypadkach:
```typescript
useSWR('/api/data', fetcher, {
  refreshInterval: 1000,  // Refresh co sekundę
  revalidateOnFocus: true,
})
```

---

## RESOURCES

- **SWR Docs**: https://swr.vercel.app/
- **Next.js Performance**: https://nextjs.org/docs/app/building-your-application/optimizing
- **React Performance**: https://react.dev/learn/render-and-commit

---

**Pamiętaj: Wydajność to nie dodatek, to requirement! ⚡**

Każda nowa funkcja MUSI być zoptymalizowana od początku.
