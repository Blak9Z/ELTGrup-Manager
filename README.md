# ELTGRUP Manager

**Platforma operationala pentru constructii si echipe de teren**

Aplicatie web full-stack pentru management operational in constructii: proiecte, lucrari, planificare, pontaj, materiale, documente, subcontractori, clienti, financiar si analitice.

## Stack tehnic

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- Prisma ORM + PostgreSQL
- NextAuth (Credentials)
- Zod + React Hook Form (pregatit pentru extindere)
- TanStack Table (dependinta pregatita)
- Zustand (dependinta pregatita)
- Recharts
- PDF export (`pdf-lib`)
- Docker + docker-compose

## Fluxuri operationale E2E

Aplicatia este organizata pe fluxuri de lucru reale, nu pe pagini izolate:

### 1) Project workflow

`Proiect -> Work Orders -> Calendar -> Pontaj -> Rapoarte zilnice -> Timeline proiect`

- proiectele centralizeaza costuri, facturi, materiale, documente, rapoarte
- lucrarile apar in calendar si in pontaj
- pontajul aprobat si update-urile de teren se reflecta in detalii proiect/lucrare
- pagina de detaliu proiect + pagina de detaliu lucrare au timeline unificat (audit + documente + costuri + rapoarte + pontaj)

### 2) Materials workflow

`Catalog materiale -> Cerere -> Aprobare/Respingere -> Miscare stoc -> Cost proiect`

- cererile au status operational + notificari
- miscarile de stoc genereaza consum proiect
- iesirile/waste pe proiect genereaza cost entry material in modul financiar
- analiticele compara consumul fata de aprobare/plan

### 3) Documents workflow

`Upload -> Asociere entitate -> Vizualizare -> Audit`

- upload document cu asociere la proiect, lucrare (work order) sau client
- documentele apar in modulele relevante (`/documente`, detalii proiect, detalii lucrare)
- fiecare upload este auditat in `ActivityLog`

## Roluri disponibile

- Super Admin
- Administrator
- Project Manager
- Site Manager / Sef de santier
- Office / Backoffice
- Worker / Technician
- Accountant
- Client Viewer
- Subcontractor

## Entitati Prisma

Schema include entitatile cerute:

- `User`, `Role`, `Permission`, `Team`, `WorkerProfile`
- `Client`, `ClientContact`
- `Project`, `ProjectPhase`, `WorkOrder`, `TaskChecklistItem`
- `TimeEntry`, `Attendance`
- `Material`, `Warehouse`, `StockMovement`, `MaterialRequest`, `ProjectMaterialUsage`
- `Equipment`, `EquipmentAssignment`
- `Subcontractor`, `SubcontractorAssignment`
- `Document`, `Invoice`, `CostEntry`
- `DailySiteReport`, `Notification`, `Comment`, `ActivityLog`

Include: enum-uri operationale, indexuri, audit fields, soft delete (`deletedAt`) pe modelele relevante.

## Seed demo ELT Grup

Seed-ul creeaza date realiste in romana:

- ELT Grup context operational
- 10 utilizatori cu roluri diferite
- 12 proiecte
- 50 lucrari
- 200 intrari pontaj
- 100 miscari de stoc
- 20 rapoarte zilnice
- 15 facturi
- subcontractori, echipe, depozite, echipamente, documente, notificari

Cont admin principal:

- Email: `eduard@eltgrup.com`
- Parola: `eltgrup`

## Setup local

1. Instaleaza dependintele:

```bash
npm install
```

2. Configureaza mediul:

```bash
cp .env.example .env
```

### Setup Supabase (recomandat)

1. In Supabase Dashboard -> Project Settings -> Database -> Connection string:
- copiaza `Transaction pooler` in `DATABASE_URL`
- copiaza `Direct connection` in `DIRECT_URL`

2. Ruleaza migrari + seed:

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

3. (Optional, doar local) Porneste PostgreSQL cu docker-compose:

```bash
docker compose up -d db
```

4. Ruleaza migrarile si seed:

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

5. Ruleaza aplicatia:

```bash
npm run dev
```

Aplicatia va fi disponibila la `http://localhost:3000`.

## Docker (app + db)

```bash
docker compose up --build
```

## Structura proiect

```txt
app/
  (auth)/autentificare
  (app)/panou
  (app)/proiecte
  (app)/lucrari
  (app)/calendar
  (app)/pontaj
  (app)/teren
  (app)/materiale
  (app)/documente
  (app)/clienti
  (app)/rapoarte-zilnice
  (app)/notificari
  (app)/echipamente
  (app)/subcontractori
  (app)/financiar
  (app)/analitice
  (app)/setari
  api/auth/[...nextauth]
  api/rapoarte-zilnice/[id]/pdf
prisma/
  schema.prisma
  seed.ts
src/
  lib/
  components/
  modules/
proxy.ts
```

## Capturi ecran (produs real)

Adauga capturi reale in `docs/screenshots/` si referentiaza-le aici:

- `dashboard.png`
- `project-timeline.png`
- `work-order-timeline.png`
- `materials-flow.png`
- `documents-linking.png`
- `analytics-actionable.png`

## Securitate si conformitate

- Rute protejate in `proxy.ts`
- Verificare sesiune in layout server-side
- Parole hashuite (`bcryptjs`)
- RBAC la nivel de pagina si action
- verificari de permisiuni pe endpoint-uri API sensibile
- Validare input cu Zod
- Audit model in baza de date (`ActivityLog`)
- notificari generate din actiuni reale (asignare, aprobare, intarziere, status factura)
- Fara secrete hardcodate, configurare prin variabile de mediu

## Observatii / asumptii

- Upload fisiere este functional prin `Document.storagePath` (S3 compatibil sau fallback local).
- `EFATURA_ENABLED` ramane un feature-flag tehnic pentru integrare externa ulterioara.
- Calendarul DnD este operational in UI; extinderea de mutare prin drag-and-drop poate fi izolata in actiune dedicata daca se doreste schimbarea de status direct din board.
