import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./create-prisma-client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
