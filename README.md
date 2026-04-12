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

## Module implementate

### Phase 1 (livrate complet)

- Autentificare (Credentials, NextAuth, parole hashuite)
- RBAC granular (roluri + matrix permisiuni)
- Dashboard operational
- Proiecte (listare + creare + update status + soft delete)
- Lucrari / Work Orders (listare + creare + update status + soft delete)
- Calendar / planning board (drag-and-drop UI)
- Pontaj (inregistrare + aprobare)
- Mod teren mobil (`/teren`)
  - pontaj live start/pauza/reluare/stop cu persistenta in DB

### Phase 2-3 (livrate ca module functionale initiale + extensibile)

- Materiale / stoc / cereri
  - cereri cu aprobare/respingere si notificari
- Documente
  - upload real fisier (S3 compatibil, fallback local in `public/uploads`)
- CRM clienti
- Rapoarte zilnice + export PDF
- Notificari
- Echipamente
- Subcontractori
- Financiar operational
- Analitice
- Setari

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

Cont demo principal:

- Email: `alex.pop@eltgrup.ro`
- Parola: `Parola123!`

## Setup local

1. Instaleaza dependintele:

```bash
npm install
```

2. Configureaza mediul:

```bash
cp .env.example .env
```

3. Porneste PostgreSQL (local sau cu docker-compose):

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

- Upload fisiere este pregatit arhitectural prin `Document.storagePath`; integrarea UploadThing/S3 se face in modul dedicat de upload.
- e-Factura este livrata ca placeholder arhitectural (`EFATURA_ENABLED`) pentru integrare ulterioara.
- Calendarul DnD este functional UI; persistenta drag-and-drop se poate activa cu endpoint/action dedicat pentru mutarea task-urilor.
