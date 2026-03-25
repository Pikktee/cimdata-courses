import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl || !/^(postgres|postgresql):\/\//.test(databaseUrl)) {
  throw new Error(
    "Ungültige oder fehlende DATABASE_URL. Bitte prüfe deine .env (Supabase Pooling URL)."
  );
}

const pool = new Pool({
  connectionString: databaseUrl
});

const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
