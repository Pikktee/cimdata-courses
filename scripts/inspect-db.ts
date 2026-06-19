import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Keine DB-URL gefunden");
  const pool = new Pool({ connectionString: url });

  const courses = await pool.query(`SELECT COUNT(*)::int AS n FROM "Course"`);
  const starts = await pool.query(`SELECT COUNT(*)::int AS n FROM "CourseStart"`);
  const range = await pool.query(
    `SELECT MIN("startDate") AS min, MAX("startDate") AS max FROM "CourseStart"`
  );
  const byMonth = await pool.query(
    `SELECT to_char("startDate", 'YYYY-MM') AS month, COUNT(*)::int AS n
     FROM "CourseStart" GROUP BY 1 ORDER BY 1`
  );
  const courseCreated = await pool.query(
    `SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM "Course" GROUP BY 1 ORDER BY 1`
  );
  const runs = await pool.query(
    `SELECT id, status, "foundCourses", "foundStarts",
            to_char("startedAt", 'YYYY-MM-DD HH24:MI') AS started,
            to_char("finishedAt", 'YYYY-MM-DD HH24:MI') AS finished
     FROM "RefreshRun" ORDER BY id DESC LIMIT 15`
  );

  console.log("=== KURSE GESAMT ===", courses.rows[0].n);
  console.log("=== STARTTERMINE GESAMT ===", starts.rows[0].n);
  console.log("=== STARTDATUM-BEREICH ===", range.rows[0]);
  console.log("=== STARTTERMINE PRO MONAT ===");
  console.table(byMonth.rows);
  console.log("=== KURSE NACH ANLAGEDATUM (createdAt) ===");
  console.table(courseCreated.rows);
  console.log("=== LETZTE REFRESH-LÄUFE ===");
  console.table(runs.rows);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
