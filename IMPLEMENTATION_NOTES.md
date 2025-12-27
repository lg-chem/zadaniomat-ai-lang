# Nowe funkcje - Baza wiedzy AI i cele fitness

## Zmiany

### 1. Partie mięśniowe (siłownia)
✅ **Już zaimplementowane!** Interfejs pozwala na wybór partii mięśniowych przy dodawaniu aktywności typu "Siłownia":
- Klata, Plecy, Barki, Biceps, Triceps, Pośladki, Nogi, Brzuch
- Statystyki partii mięśniowych wyświetlane w widoku tygodniowym

### 2. Baza wiedzy kontekstowa dla AI
Dodano możliwość dodania kontekstu dla asystenta AI:

**Nowe modele bazy danych:**
- `AIKnowledgeBase` - przechowuje wiedzę kontekstową dla AI
  - `personalInfo` - informacje osobiste i fitness (dla PRIVATE workspace)
  - `companyInfo` - informacje o firmie (dla WORK workspace)
  - `chatInstructions` - instrukcje jak chat ma się zachowywać

**Nowe API endpoints:**
- `GET /api/ai/knowledge?workspaceType=WORK|PRIVATE` - pobiera bazę wiedzy
- `PUT /api/ai/knowledge` - aktualizuje bazę wiedzy

**UI w ustawieniach:**
- Nowa sekcja "Baza wiedzy AI" w `/settings`
- Różne pola w zależności od workspace (WORK/PRIVATE)
- Możliwość definiowania instrukcji dla chata

### 3. Cele fitness na okres
Dodano możliwość tworzenia celów fitness z datami:

**Nowy model bazy danych:**
- `FitnessGoal` - cele fitness z okresem czasowym
  - Typy celów: WEIGHT_LOSS, WEIGHT_GAIN, MUSCLE_GAIN, CARDIO_IMPROVEMENT, STRENGTH_INCREASE, FLEXIBILITY, ENDURANCE, BODY_FAT_REDUCTION, CUSTOM
  - Możliwość przypisania do Period
  - Śledzenie postępu (currentValue vs targetValue)

**Nowe API endpoints:**
- `GET /api/fitness-goals?workspaceType=WORK|PRIVATE&periodId=xxx&includeActive=true` - lista celów
- `POST /api/fitness-goals` - tworzenie nowego celu
- `PATCH /api/fitness-goals/[id]` - aktualizacja postępu celu
- `DELETE /api/fitness-goals/[id]` - usuwanie celu

### 4. Integracja z AI chatem
AI chat został rozszerzony o:
- Dostęp do bazy wiedzy kontekstowej
- Dostęp do aktywnych celów fitness
- Uwzględnianie instrukcji użytkownika (`chatInstructions`)

## Instrukcje wdrożenia

### 1. Uruchom migrację bazy danych
```bash
npx prisma db push
```

Lub jeśli wolisz named migration:
```bash
npx prisma migrate dev --name add-ai-knowledge-base-and-fitness-goals
```

### 2. Wygeneruj klienta Prisma
```bash
npx prisma generate
```

### 3. Restart serwera deweloperskiego
```bash
npm run dev
```

## Jak używać

### Baza wiedzy AI
1. Przejdź do `/settings`
2. Znajdź sekcję "Baza wiedzy AI"
3. Uzupełnij:
   - **Dla PRIVATE workspace:** Informacje osobiste i fitness (wiek, waga, cele, preferencje)
   - **Dla WORK workspace:** Informacje o firmie i projektach
   - **Instrukcje dla AI:** Jak chat ma się komunikować (np. "Odpowiadaj zwięźle", "Używaj bullet points")
4. Kliknij "Zapisz bazę wiedzy"

### Cele fitness (API)
Przykład tworzenia celu:
```javascript
POST /api/fitness-goals
{
  "name": "Schudnąć 5kg",
  "description": "Redukcja wagi przed latem",
  "goalType": "WEIGHT_LOSS",
  "targetValue": 75,
  "currentValue": 80,
  "unit": "kg",
  "startDate": "2025-01-01",
  "endDate": "2025-03-31",
  "workspaceType": "PRIVATE",
  "periodId": "optional-period-id"
}
```

Aktualizacja postępu:
```javascript
PATCH /api/fitness-goals/[id]
{
  "currentValue": 78
}
```

## Struktura plików

```
prisma/schema.prisma                     # Nowe modele: AIKnowledgeBase, FitnessGoal
src/app/api/ai/knowledge/route.ts       # API bazy wiedzy
src/app/api/fitness-goals/route.ts      # API celów fitness
src/app/api/fitness-goals/[id]/route.ts # API pojedynczego celu
src/app/api/ai/chat/route.ts            # Rozszerzona integracja AI
src/app/(dashboard)/settings/page.tsx    # UI bazy wiedzy
src/components/ui/textarea.tsx          # Nowy komponent
```

## Następne kroki (opcjonalne)

- [ ] Dodać UI do zarządzania celami fitness (strona `/fitness-goals`)
- [ ] Dodać wykresy postępu dla celów fitness
- [ ] Dodać notyfikacje o zbliżających się deadline'ach celów
- [ ] Rozszerzyć AI o proponowanie planów treningowych bazujących na celach
