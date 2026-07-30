# Reset hasła (gdy nie możesz się zalogować)

W aplikacji **nie ma** funkcji "zapomniałem hasła" — hasła są trzymane jako hash bcrypt
(cost 12) w kolumnie `password` tabeli `"User"`. Poniżej dwie drogi awaryjne.

## Opcja A — skrypt (najprościej)

Potrzebujesz `DATABASE_URL` z Neona (Dashboard → Connection string, wariant "pooled" też działa).

```bash
# lista kont w bazie
npm run reset-password -- --list

# zmiana hasła
npm run reset-password -- admin@example.com NoweHaslo123

# zmiana hasła + nadanie roli SUPER_ADMIN
npm run reset-password -- admin@example.com NoweHaslo123 --make-admin
```

Skrypt sam wczyta `.env.local` / `.env`. Bez pliku `.env` podaj zmienną w locie:

```bash
DATABASE_URL="postgresql://..." npm run reset-password -- admin@example.com NoweHaslo123
```

Skrypt przy okazji ustawia `isApproved = true`, żeby konto nie utknęło na ekranie
oczekiwania na akceptację.

## Opcja B — SQL bezpośrednio w Neonie

W Neon Console → **SQL Editor**. Postgres potrafi policzyć bcrypt przez rozszerzenie
`pgcrypto`, więc hash da się wygenerować bez uruchamiania aplikacji:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- podgląd kont
SELECT email, role, "isApproved" FROM "User" ORDER BY "createdAt";

-- reset hasła (podmień email i hasło)
UPDATE "User"
SET password = crypt('NoweHaslo123', gen_salt('bf', 12)),
    "isApproved" = true
WHERE email = 'admin@example.com';
```

`gen_salt('bf', 12)` tworzy hash `$2a$12$...`, który `bcryptjs` w `src/lib/auth.ts`
poprawnie weryfikuje.

Awaryjnie, gdy nie ma żadnego admina:

```sql
UPDATE "User" SET role = 'SUPER_ADMIN', "isApproved" = true
WHERE email = 'admin@example.com';
```

## Potem

Zalogowany admin może zmieniać hasła innych użytkowników z poziomu `/admin`
(endpoint `PATCH /api/admin/users/[id]/password`) — hasła innych adminów tylko
z rolą `SUPER_ADMIN`.

> Po takim resecie zmień hasło na własne w `/settings` i nie zostawiaj tymczasowego
> hasła w historii terminala.
