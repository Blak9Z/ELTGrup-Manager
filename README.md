# ELTGRUP Manager

Platforma de operare pentru echipe de constructii: proiecte, lucrari, calendar, pontaj, teren, materiale, documente, clienti, subcontractori, financiar, analitice si notificari.

## Ce rezolva

Aplicatia acopera fluxul complet de executie:

1. `Proiect -> Lucrari -> Calendar -> Pontaj -> Rapoarte teren`
2. `Cerere materiale -> Aprobare -> Emitere stoc -> Cost proiect`
3. `Documente -> Asociere pe proiect/lucrare/client -> Audit trail`
4. `Facturi si costuri -> Vizibilitate marja -> Export operational`

Toate modulele sunt filtrate dupa rol + acces in scope (proiect/echipa), cu verificari atat in UI cat si in server actions.

## Module principale

- Panou (`/panou`)
- Proiecte (`/proiecte`)
- Lucrari (`/lucrari`)
- Calendar (`/calendar`)
- Pontaj (`/pontaj`)
- Teren (`/teren`)
- Materiale (`/materiale`)
- Documente (`/documente`)
- Clienti (`/clienti`)
- Rapoarte zilnice (`/rapoarte-zilnice`)
- Subcontractori (`/subcontractori`)
- Financiar (`/financiar`)
- Analitice (`/analitice`)
- Notificari (`/notificari`)
- Setari / utilizatori / roluri (`/setari`)

## Stack tehnic

- Next.js 16 (App Router)
- React 19 + TypeScript
- Prisma ORM + PostgreSQL
- NextAuth (credentials)
- Zod (validare server actions)
- Tailwind CSS
- Vitest + ESLint
- `pdf-lib` pentru export PDF
- Upload documente: S3 compatibil sau fallback local

## Cerinte

- Node.js 20+
- npm 10+
- PostgreSQL (local, Docker sau server extern)

## Setup local rapid

1. Instaleaza dependintele:

```bash
npm install
```

2. Creeaza fisierul de configurare:

```bash
cp .env.example .env
```

3. Completeaza variabilele obligatorii (vezi sectiunea de mai jos).

4. Genereaza client Prisma, ruleaza migrari si seed:

```bash
npm run db:generate
npm run db:migrate -- --name init
```

Seed mode-ul implicit este `safe`.

- `safe` - refresh RBAC only, fara date demo
- `bootstrap` - creeaza un singur `SUPER_ADMIN` initial pe o baza fara useri
- `demo` - date de onboarding, doar pe o baza noua/disposable

Pentru primul utilizator pe o baza goala:

```bash
SEED_MODE=bootstrap \
SEED_BOOTSTRAP_EMAIL="admin@eltgrup.local" \
SEED_BOOTSTRAP_FIRST_NAME="Admin" \
SEED_BOOTSTRAP_LAST_NAME="Platforma" \
SEED_BOOTSTRAP_PASSWORD="schimba-cu-o-parola-lunga" \
npm run db:seed
```

Pentru un refresh RBAC fara date demo:

```bash
npm run db:seed
```

Nu folosi niciodata `demo` pe baze migrate sau live.
Nu pastra variabilele pentru `demo` permanent in `.env`; foloseste comenzi one-off.

Exemplu one-off pentru demo (numai local/test):

```bash
NODE_ENV=development SEED_MODE=demo SEED_DEMO_CONFIRM=RUN_DEMO_SEED SEED_PASSWORD="<parola-lunga>" npm run db:seed
```

5. Porneste aplicatia:

```bash
npm run dev
```

Aplicatia este disponibila la `http://localhost:3000`.

## Variabile de mediu importante

Minim necesar:

- `DATABASE_URL` - conexiune aplicatie
- `DIRECT_URL` - conexiune directa pentru migrari Prisma
- `NEXTAUTH_SECRET` - secret semnare sesiuni
- `NEXTAUTH_URL` - URL-ul public al aplicatiei

Nota importanta pentru Postgres + Prisma:

- Evita `connection_limit=1` in `DATABASE_URL` pentru runtime.
- Pentru modulele acestui proiect (care ruleaza query-uri paralele) foloseste minim `connection_limit=5` (recomandat `10+` pentru trafic real).

Optional pentru upload S3 compatibil:

- `STORAGE_ENDPOINT`
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- `STORAGE_BUCKET`

Daca variabilele de storage lipsesc, upload-ul merge pe fallback local in `public/uploads`.

Seed vars:

- `SEED_MODE` - `safe` / `bootstrap` / `demo`
- `SEED_BOOTSTRAP_EMAIL`, `SEED_BOOTSTRAP_FIRST_NAME`, `SEED_BOOTSTRAP_LAST_NAME`, `SEED_BOOTSTRAP_PASSWORD` - folosite o singura data, pentru primul `SUPER_ADMIN`
- `SEED_DEMO_CONFIRM` - trebuie sa fie exact `RUN_DEMO_SEED` pentru `demo`
- `SEED_PASSWORD` - parola explicita pentru utilizatorii demo; nu exista fallback implicit

## Scripturi utile

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test:run
npm run test:coverage
npm run db:generate
npm run db:migrate -- --name <nume>
npm run db:seed
npm run db:verify
npm run db:migrate:postgres
npm run db:migrate:supabase
```

Seed safety:

- `SEED_MODE=safe` este implicit si face doar refresh RBAC.
- `SEED_MODE=bootstrap` se foloseste o singura data, cand `users` este gol.
- `SEED_MODE=demo` cere `SEED_DEMO_CONFIRM=RUN_DEMO_SEED` si `SEED_PASSWORD`, si este permis doar pe o baza noua/disposable.
- `SEED_MODE=demo` este permis doar cand `NODE_ENV` este `development` sau `test`.
- `SEED_MODE=demo` este blocat daca oricare dintre `VERCEL_ENV`, `APP_ENV`, `DEPLOY_ENV` indica `production` / `prod` / `staging` / `stage` / `preview` sau alt context necunoscut.
- Nu rula `demo` pe baze migrate sau live.

Migrare DB catre server Postgres:

- rulebook complet: `docs/postgres-db-migration.md`
- script automat: `scripts/migrate-postgres.sh`

## Calitate / productie

Pipeline minim recomandat in CI:

```bash
npx tsc --noEmit
npm run lint
npm run test:run
npm run build
```

## Deploy live (Vercel)

Repository-ul este deja link-uit la proiectul Vercel `eltgrupmanager`.

Deploy productie din branch-ul curent:

```bash
vercel --prod
```

sau cu npx:

```bash
npx vercel --prod
```

Pentru productie cu Prisma:

1. Asigura `DATABASE_URL` + `DIRECT_URL` in Vercel Project Settings.
2. Ruleaza migrarile in productie cu:

```bash
npx prisma migrate deploy
```

3. Verifica dupa deploy:

- login
- acces pe module in functie de rol
- creare/actualizare date pe fluxurile critice (lucrari, pontaj, materiale, facturi)
- exporturi CSV/PDF

## Structura proiect

```txt
app/
  (app)/...module UI + actions
  api/...exporturi si endpoint-uri
src/
  components/...
  lib/...auth, rbac, scope, utilitare
  modules/...componente dashboard
prisma/
  schema.prisma
  seed.ts
proxy.ts
docs/
  ARCHITECTURE.md  - Detalii tehnice si fluxuri de securitate
  DATABASE.md      - Schema bazei de date si optimizari
  USER_GUIDE.md    - Ghid de utilizare pentru modulele principale
```

## Securitate si acces

- Rute protejate in `proxy.ts`
- Validare permisiuni prin RBAC (`src/lib/rbac.ts`)
- Scope dinamic pe proiect/echipa (`src/lib/access-scope.ts`)
- Verificari server-side in toate actiunile sensibile
- Audit operational in `ActivityLog`

## Note

- Aplicatia este construita pentru operare reala (nu demo static).
- Cand extinzi modulele, mentine regula: validare + permisiune + scope + audit pentru fiecare mutatie de date.
