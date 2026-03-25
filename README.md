# CIMDATA Kurs-Scraper

Eine Webanwendung zur Anzeige von CIMDATA-Kursen (nur Kurse, keine Kurspakete) mit Filterung nach konkretem Startdatum.

## Kurzbeschreibung

Die Web-App stellt Kursdaten bereit und liest diese read-only aus einer Supabase-Postgres-Datenbank.  
Die Daten werden ausschließlich beim manuellen CLI-Refresh (`npm run refresh`) aus der CIMDATA Education API geholt und in die Datenbank geschrieben.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 7 + Postgres (Supabase)
- Datenquelle: CIMDATA Education API (paginiert via `fetch`)
- Refresh-Pipeline: CLI (`tsx scripts/refresh.ts`)
- Styling: globale CSS-Datei

## Architektur

### Komponenten und Verantwortlichkeiten

- `src/lib/scraper/cimdata.ts`
  - Lädt paginiert alle Kursitems aus:
    - `https://api-gateway.cimdata.de/api/v1/education/courses/1?...&package=false...`
  - Filtert auf echte Kurse (`isCoursePack === false`)
  - Normalisiert Starttermine in ISO-Format

- `src/lib/courses.ts`
  - Fachlogik für:
    - `refreshCoursesFromSource()` (Scrape -> Upsert -> Cleanup -> Refresh-Log)
    - `getCoursesByStartDate()` (Filterabfrage + verfügbare Startdaten)
    - `getLatestRefreshRun()` (letzten Refreshstatus)

- `src/lib/db.ts`
  - Prisma-Client-Initialisierung für Postgres

- `src/app/api/courses/route.ts`
  - Read-only API-Endpunkt:
    - `GET /api/courses`
    - optionaler Query-Param: `startDate=YYYY-MM-DD`

- `src/app/page.tsx`
  - Server Component mit Initialdaten aus der Datenbank

- `src/components/CourseBrowser.tsx`
  - Client-Komponente für Interaktion (Datumsauswahl, clientseitiges Filtern)

- `prisma/schema.prisma`
  - Datenmodell:
    - `Course`
    - `CourseStart`
    - `RefreshRun`

### Datenfluss

1. Manuelles Update über CLI:
   - `npm run refresh`
2. Scraper holt alle Kursitems aus der CIMDATA Education API (paginiert).
3. Persistenz in Supabase Postgres via Prisma (`Course` + `CourseStart` + `RefreshRun`-Status).
4. Server lädt initial alle Kurse aus der Datenbank (via `getCoursesByStartDate(null)`), Client filtert danach ausschließlich lokal.
5. Nutzer filtert nach konkretem Startdatum; es gibt keine weiteren API-Requests pro Filterwechsel.

## API

### `GET /api/courses`

Liefert:

- `availableStartDates`: alle konkreten Startdaten (ISO)
- `courses`: Kursliste (optional gefiltert)
- `latestRefresh`: letzter Refresh-Lauf (oder `null`)

Wenn `latestRefresh` vorhanden ist, enthält es u. a.:

- `status`: `running | success | failed`
- `foundCourses`: Anzahl gefundener Kurse
- `foundStarts`: Anzahl gefundener Starttermine
- `startedAt`, `finishedAt`: Zeitstempel als ISO-Strings
- `message`: optionaler Fehlertext

Query-Parameter:

- `startDate` (optional), z. B. `2026-04-15`

Hinweis: Es gibt absichtlich **kein** `POST /api/refresh` mehr.

## Lokale Entwicklung

```bash
cd /Users/henrik/Dev/cimdata
cp .env.example .env
npm install
npm run db:push
npm run refresh
npm run dev
```

App im Browser:

- `http://localhost:3000`

## Nützliche Commands

```bash
npm run refresh   # Kursdaten von CIMDATA neu laden (CLI-only)
npm run dev       # Entwicklungsserver starten
npm run build     # Produktionsbuild prüfen
npm run lint      # Linting
npm run db:push  # Datenbankschema in Supabase synchronisieren
```

## Deployment (einfach) mit Supabase + Vercel

### 1) Supabase Projekt anlegen

1. Gehe zu [Supabase](https://supabase.com/) und erstelle ein neues Projekt.
2. Öffne im Projekt `Project Settings -> Database`.
3. Kopiere:
   - **Connection pooling URL** (für `DATABASE_URL`, Laufzeit)
   - **Direct connection URL** (für `DIRECT_URL`, Prisma-Migrationen)

### 2) Lokale App auf Supabase umstellen

1. In `.env` eintragen:
   - `DATABASE_URL=...` (Pooler, meist Port `6543`)
   - `DIRECT_URL=...` (direkt, meist Port `5432`)
2. Schema deployen:
   - `npm run db:push`
3. Daten einmalig laden:
   - `npm run refresh`
4. Lokal testen:
   - `npm run dev`

### 3) Vercel Deployment

1. Repo auf Vercel importieren.
2. In Vercel `Environment Variables` setzen:
   - `DATABASE_URL`
   - `DIRECT_URL`
3. Deploy auslösen.

### 4) Datenaktualisierung im Betrieb

Da die App bewusst nur CLI-Refresh nutzt:

- Lokal/CI ausführen: `npm run refresh`
- Optional automatisieren über GitHub Actions (Cron), z. B. täglich.
