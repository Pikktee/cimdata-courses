import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const rawDatabaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const sqlitePath = rawDatabaseUrl.startsWith("file:")
  ? rawDatabaseUrl.replace(/^file:/, "")
  : rawDatabaseUrl;
const adapter = new PrismaBetterSqlite3({ url: sqlitePath });

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
