import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveTursoConfig } from "./turso-config";

/** Local SQLite by default; Turso when TURSO_* env vars are set (Vercel production). */
export function createPrismaClient(): PrismaClient {
  const turso = resolveTursoConfig();

  if (turso) {
    const adapter = new PrismaLibSql({
      url: turso.url,
      authToken: turso.authToken,
    });
    return new PrismaClient({ adapter });
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Turso is not configured on Vercel. Set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (Production), then redeploy. Check /api/db-check after deploy.",
    );
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}
