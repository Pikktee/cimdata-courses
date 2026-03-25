# CIMDATA Kurs-Scraper

Eine Webanwendung zur Anzeige von CIMDATA-Kursen (nur Kurse, keine Kurspakete) mit Filterung nach konkretem Startdatum.

## Kurzbeschreibung

Die Web-App stellt Kursdaten bereit und liest diese read-only aus einer Supabase-Postgres-Datenbank.  
Die Daten werden aus der CIMDATA Education API geholt und per **CLI** (`npm run refresh`) oder optional per **[Vercel Cron](https://vercel.com/docs/cron-jobs)** (`GET /api/internal/refresh-courses` mit `CRON_SECRET`) in die Datenbank geschrieben.

**Produktions-URL:** [https://cimdata-kurse.henrikheil.net](https://cimdata-kurse.henrikheil.net)

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 7 + Postgres (Supabase)
- Datenquelle: CIMDATA Education API (paginiert via `fetch`)
- Refresh-Pipeline: CLI (`tsx scripts/refresh.ts`) oder geschützter Cron (`/api/internal/refresh-courses`)
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

- `src/app/api/internal/refresh-courses/route.ts`
  - Geschützter Refresh für Vercel Cron: `GET /api/internal/refresh-courses`
  - Erwartet `Authorization: Bearer <CRON_SECRET>` (Vercel setzt das automatisch, wenn `CRON_SECRET` im Projekt konfiguriert ist)

- `vercel.json`
  - Cron: täglich **06:00 UTC** (`0 6 * * *`); Plan **Hobby** erlaubt nur einmal pro Tag

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

1. Manuelles Update über CLI (`npm run refresh`) oder Produktions-Cron (`/api/internal/refresh-courses`).
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

### `GET /api/internal/refresh-courses`

Nur mit gültigem **Bearer-Token** (`CRON_SECRET`):

- Header: `Authorization: Bearer <CRON_SECRET>`

Erfolg (`200`): JSON mit `ok`, `foundCourses`, `foundStarts`.  
Fehler beim Refresh (`500`): `ok: false`, `error`.  
Ohne/ falsches Secret: `401`.

Lokal testen (Server läuft, `.env` enthält `CRON_SECRET`):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/internal/refresh-courses"
```

Gegen Produktion (gleicher Header, angepasste Basis-URL):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://cimdata-kurse.henrikheil.net/api/internal/refresh-courses"
```

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
   - `CRON_SECRET` (z. B. zufällige Zeichenkette ≥ 16 Zeichen; ohne Secret schlägt der Cron mit **401** fehl)
3. Custom Domain in Vercel zuweisen (z. B. `cimdata-kurse.henrikheil.net`) und Deploy auslösen — danach ist der in `vercel.json` definierte Cron aktiv (**nur Production**).

### 4) Datenaktualisierung im Betrieb

- **Vercel:** Täglicher Aufruf von `https://cimdata-kurse.henrikheil.net/api/internal/refresh-courses` (Pfad siehe `vercel.json`); Vercel hängt `Authorization: Bearer` automatisch an, wenn `CRON_SECRET` gesetzt ist.
- **Manuell / CI:** `npm run refresh` oder `curl` mit Bearer-Header gegen `https://cimdata-kurse.henrikheil.net/...`.
- **Hobby:** Cron maximal **einmal pro Tag**; häufigere Schedules werden beim Deploy abgelehnt.

**Deployment & Domains (wichtig):** Es können **drei verschiedene Zustände** gleichzeitig existieren:

| Symptom | Typische Ursache |
|--------|-------------------|
| Custom Domain: Startseite/API **200**, `/api/internal/refresh-courses` **HTML-404** | Auf dieser Domain läuft noch ein **älteres Deployment** (ohne Cron-Route) und/oder eine **gecachte 404** an der Edge. Nach einem Deploy mit Cron-Route: Production neu deployen, ggf. **Data Cache** leeren. |
| `*.vercel.app`: Startseite & `/api/courses` **500** | Auf diesem Alias läuft ein Deployment **ohne gültige `DATABASE_URL`** (oder falsches Vercel-Projekt). `DATABASE_URL` / `DIRECT_URL` in **Project → Settings → Environment Variables** für **Production** prüfen und erneut deployen. |
| Lokal / korrektes Deployment: `/api/internal/refresh-courses` **401** + Text `Unauthorized` | Route ist erreichbar; nur das **Bearer-Token** fehlt oder ist falsch. |

Der Cron-Endpunkt setzt `Cache-Control: no-store`, damit gültige Antworten nicht an der Edge hängenbleiben.

**Korrekter `curl` (Produktion):**

```bash
curl -sS -i -H "Authorization: Bearer DEIN_CRON_SECRET" \
  "https://cimdata-kurse.henrikheil.net/api/internal/refresh-courses"
```

Erwartung bei **falschem** Secret: **401** und Body `Unauthorized` (kein großes HTML). **HTML mit „404: This page could not be found“** = Route existiert auf dieser Domain noch nicht (Deploy/Cache) — nicht nur ein Secret-Problem.

Der frühere Pfad `/api/cron/refresh` wird **nicht** mehr verwendet (Vercel Edge konnte dort eine **stale 404** ausliefern). Cron und manuelle Aufruf bitte nur noch über **`/api/internal/refresh-courses`**.
