import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

// Stellt verlorene Vergangenheits-Termine aus dem lokalen SQLite-Snapshot (dev.db)
// in der Produktions-DB wieder her. Standard: Dry-Run. Mit "--apply" wird geschrieben.
// Nur Termine VOR diesem Stichtag werden betrachtet (Zukunft kommt aus dem Live-Scrape).
const CUTOFF = "2026-06-20"; // exklusiv: nur startDate < CUTOFF (verlorene Vergangenheit)
const APPLY = process.argv.includes("--apply");

function isoMidnightUtc(value: string): string {
  // value z.B. "2026-04-15T00:00:00.000+00:00" -> "2026-04-15T00:00:00.000Z"
  return `${value.slice(0, 10)}T00:00:00.000Z`;
}

async function main() {
  const sqlite = new DatabaseSync("dev.db", { readOnly: true });
  const rows = sqlite
    .prepare(
      `SELECT c.slug AS slug, c.title AS title, s.startDate AS startDate, s.rawText AS rawText
       FROM CourseStart s JOIN Course c ON c.id = s.courseId
       WHERE s.startDate < ? ORDER BY c.slug, s.startDate`
    )
    .all(CUTOFF) as Array<{ slug: string; title: string; startDate: string; rawText: string }>;

  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

  // Produktions-Kurse: slug -> id
  const prodCourses = await pool.query<{ id: number; slug: string }>(`SELECT id, slug FROM "Course"`);
  const slugToId = new Map(prodCourses.rows.map((r) => [r.slug, r.id]));

  // Bereits vorhandene (courseId, startDate)-Paare in Produktion (zur Sicherheit)
  const existing = await pool.query<{ courseId: number; iso: string }>(
    `SELECT "courseId", to_char("startDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS iso FROM "CourseStart"`
  );
  const existingSet = new Set(existing.rows.map((r) => `${r.courseId}|${r.iso}`));

  const toInsert: Array<{ courseId: number; iso: string; rawText: string }> = [];
  const unmatchedSlugs = new Set<string>();
  let alreadyPresent = 0;

  for (const row of rows) {
    const courseId = slugToId.get(row.slug);
    if (!courseId) {
      unmatchedSlugs.add(`${row.slug} — ${row.title}`);
      continue;
    }
    const iso = row.startDate.slice(0, 10);
    if (existingSet.has(`${courseId}|${iso}`)) {
      alreadyPresent++;
      continue;
    }
    toInsert.push({ courseId, iso, rawText: row.rawText || iso });
  }

  console.log(`Snapshot-Zeilen (Termine < ${CUTOFF}): ${rows.length}`);
  console.log(`Wiederherstellbar (fehlen in Produktion): ${toInsert.length}`);
  console.log(`Schon vorhanden (übersprungen): ${alreadyPresent}`);
  console.log(`Nicht zuordenbare Kurse (Slug fehlt in Produktion): ${unmatchedSlugs.size}`);
  if (unmatchedSlugs.size > 0) {
    for (const s of unmatchedSlugs) console.log(`   - ${s}`);
  }

  const byMonth = new Map<string, number>();
  for (const r of toInsert) {
    const m = r.iso.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  console.log("Wiederherstellbar pro Monat:", Object.fromEntries([...byMonth].sort()));

  if (!APPLY) {
    console.log("\n>>> DRY-RUN. Zum tatsächlichen Schreiben mit '--apply' erneut ausführen.");
    sqlite.close();
    await pool.end();
    return;
  }

  // Schreiben: ON CONFLICT DO NOTHING gegen den eindeutigen Index (courseId, startDate)
  let inserted = 0;
  for (const r of toInsert) {
    const res = await pool.query(
      `INSERT INTO "CourseStart" ("courseId", "startDate", "rawText", "createdAt")
       VALUES ($1, $2::timestamp, $3, now())
       ON CONFLICT ("courseId", "startDate") DO NOTHING`,
      [r.courseId, isoMidnightUtc(r.iso), r.rawText]
    );
    inserted += res.rowCount ?? 0;
  }
  console.log(`\n✅ Eingefügt: ${inserted} Termine wiederhergestellt.`);

  sqlite.close();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
