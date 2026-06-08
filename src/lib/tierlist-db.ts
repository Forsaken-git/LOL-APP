import type { LoLRole, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TierlistPlayerSummary = {
  id: string;
  displayName: string;
  teamRole: LoLRole;
  memberRole: UserRole;
};

export type TierlistRow = {
  id: string;
  name: string;
  category: string;
  rows: string;
  playerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Read tierlists with playerId (works even if Prisma client is stale). */
export async function listAllTierlists(): Promise<TierlistRow[]> {
  return prisma.$queryRaw<TierlistRow[]>`
    SELECT id, name, category, rows, playerId, createdAt, updatedAt
    FROM Tierlist
    ORDER BY updatedAt DESC
  `;
}

export async function getTierlistById(id: string): Promise<TierlistRow | null> {
  const rows = await prisma.$queryRaw<TierlistRow[]>`
    SELECT id, name, category, rows, playerId, createdAt, updatedAt
    FROM Tierlist
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function setTierlistPlayerId(
  tierlistId: string,
  playerId: string | null,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE Tierlist
    SET playerId = ${playerId}, updatedAt = ${new Date().toISOString()}
    WHERE id = ${tierlistId}
  `;
}

export async function listActivePlayers(): Promise<TierlistPlayerSummary[]> {
  return prisma.player.findMany({
    where: { active: true },
    select: { id: true, displayName: true, teamRole: true, memberRole: true },
  });
}

export function attachPlayersToTierlists<
  T extends { playerId: string | null },
>(
  tierlists: T[],
  players: TierlistPlayerSummary[],
): (T & { player: TierlistPlayerSummary | null })[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return tierlists.map((t) => ({
    ...t,
    player: t.playerId ? (byId.get(t.playerId) ?? null) : null,
  }));
}
