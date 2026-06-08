import { prisma } from "@/lib/prisma";
import { CHAMPIONS } from "@/lib/champions";

export const ROLE_KEYS = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const;
export type ChampionRole = (typeof ROLE_KEYS)[number];

export type ChampionRoleData = {
  primaryRoleByChampion: Record<string, ChampionRole | null>;
};

function roleFromPosition(position: string | null): ChampionRole | null {
  if (!position) return null;
  const p = position.toUpperCase();
  if (p === "TOP") return "TOP";
  if (p === "JUNGLE") return "JUNGLE";
  if (p === "MIDDLE" || p === "MID") return "MID";
  if (p === "BOTTOM" || p === "ADC") return "ADC";
  if (p === "UTILITY" || p === "SUPPORT") return "SUPPORT";
  return null;
}

export async function getChampionRoleData(): Promise<ChampionRoleData> {
  const championSet = new Set(CHAMPIONS as unknown as string[]);

  const grouped = await prisma.matchParticipant.groupBy({
    by: ["champion", "position"],
    where: { position: { not: null } },
    _count: { _all: true },
  });

  const roleCountsByChampion: Record<string, Record<ChampionRole, number>> = {};

  for (const row of grouped) {
    const champion = row.champion;
    if (!championSet.has(champion)) continue;
    const role = roleFromPosition(row.position as unknown as string | null);
    if (!role) continue;

    if (!roleCountsByChampion[champion]) {
      roleCountsByChampion[champion] = {
        TOP: 0,
        JUNGLE: 0,
        MID: 0,
        ADC: 0,
        SUPPORT: 0,
      };
    }

    roleCountsByChampion[champion][role] += row._count._all;
  }

  const primaryRoleByChampion: Record<string, ChampionRole | null> = {};
  for (const [champion, counts] of Object.entries(roleCountsByChampion)) {
    let best: ChampionRole | null = null;
    let bestScore = -1;
    for (const r of ROLE_KEYS) {
      const score = counts[r] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    primaryRoleByChampion[champion] = best;
  }

  return { primaryRoleByChampion };
}
