import "dotenv/config";
import { Pool } from "pg";
import { writeFileSync, mkdirSync } from "node:fs";

async function main() {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Keine DB-URL gefunden");
  const stamp = process.argv[2] || "manual";
  const pool = new Pool({ connectionString: url });

  const courses = await pool.query(`SELECT * FROM "Course" ORDER BY id`);
  const starts = await pool.query(`SELECT * FROM "CourseStart" ORDER BY id`);
  const runs = await pool.query(`SELECT * FROM "RefreshRun" ORDER BY id`);

  const backup = {
    exportedAt: new Date().toISOString(),
    counts: {
      Course: courses.rowCount,
      CourseStart: starts.rowCount,
      RefreshRun: runs.rowCount
    },
    data: {
      Course: courses.rows,
      CourseStart: starts.rows,
      RefreshRun: runs.rows
    }
  };

  mkdirSync("backups", { recursive: true });
  const file = `backups/db-backup-${stamp}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");
  console.log(`Backup geschrieben: ${file}`);
  console.log("Zeilen:", backup.counts);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
