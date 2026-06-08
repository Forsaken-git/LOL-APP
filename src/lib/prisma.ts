import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function tursoConfig(): { url: string; authToken: string | undefined } | null {
  const url =
    process.env.TURSO_DATABASE_URL ??
    (process.env.DATABASE_URL?.startsWith("libsql:")
      ? process.env.DATABASE_URL
      : undefined);

  if (!url) return null;

  return {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN,
  };
}

function prismaLog(): Prisma.LogLevel[] {
  return process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
}

function createPrismaClient(): PrismaClient {
  const turso = tursoConfig();
  const log = prismaLog();

  if (turso) {
    const adapter = new PrismaLibSql({
      url: turso.url,
      authToken: turso.authToken,
    });
    return new PrismaClient({ adapter, log });
  }

  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
