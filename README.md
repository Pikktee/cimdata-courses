# CIMDATA Kurs-Scraper

Eine Webanwendung zur Anzeige von CIMDATA-Kursen (nur Kurse, keine Kurspakete) mit Filterung nach konkretem Startdatum.

## Kurzbeschreibung

Die App lädt Kursdaten serverseitig aus der CIMDATA-API, speichert sie lokal in SQLite und stellt sie in einer modernen Next.js-Oberfläche bereit.  
Aktualisierungen erfolgen ausschließlich manuell über den CLI-Befehl `npm run refresh`.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 7 mit SQLite (`better-sqlite3` Adapter)
- Serverseitiges Scraping über den CIMDATA-Education-Endpoint
- Styling über globale CSS-Datei

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
  - Prisma-Client-Initialisierung mit SQLite-Adapter

- `src/app/api/courses/route.ts`
  - Read-only API-Endpunkt:
    - `GET /api/courses`
    - optionaler Query-Param: `startDate=YYYY-MM-DD`

- `src/app/page.tsx`
  - Server Component mit Initialdaten aus der Datenbank

- `src/components/CourseBrowser.tsx`
  - Client-Komponente für Interaktion (Datumsauswahl, Nachladen gefilterter Kurse)

- `prisma/schema.prisma`
  - Datenmodell:
    - `Course`
    - `CourseStart`
    - `RefreshRun`

### Datenfluss

1. Manuelles Update über CLI:
   - `npm run refresh`
2. Scraper holt alle Kursseiten aus der CIMDATA-API (paginiert).
3. Persistenz in SQLite via Prisma (`Course` + `CourseStart`).
4. UI lädt Daten über `GET /api/courses`.
5. Nutzer filtert nach konkretem Startdatum; API liefert passende Kurse.

## API

### `GET /api/courses`

Liefert:
- `availableStartDates`: alle konkreten Startdaten (ISO)
- `courses`: Kursliste (optional gefiltert)
- `latestRefresh`: letzter Refresh-Lauf

Query-Parameter:
- `startDate` (optional), z. B. `2026-04-15`

Hinweis: Es gibt absichtlich **kein** `POST /api/refresh` mehr.

## Lokale Entwicklung

```bash
cd /Users/henrik/Dev/cimdata
cp .env.example .env
npm install
npx prisma db push
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
```
