import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./create-prisma-client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Lazy proxy so env vars are read on first query, not at module load. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
