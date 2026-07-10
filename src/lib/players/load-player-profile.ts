import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPlayerProfile } from "@/lib/player-stats";

export const playerProfileInclude = {
  accounts: { orderBy: [{ region: "asc" }, { createdAt: "asc" }] },
  participations: {
    include: {
      match: {
        select: {
          playedAt: true,
          result: true,
          side: true,
        },
      },
    },
  },
} satisfies Prisma.PlayerInclude;

export async function loadPlayerProfileById(id: string) {
  const row = await prisma.player.findUnique({
    where: { id },
    include: playerProfileInclude,
  });
  if (!row) return null;
  return buildPlayerProfile(row);
}
