import { prisma } from "@/lib/prisma";
import { activeTeamPlayerWhere } from "@/lib/players/team-player";
import {
  comparePlayersByRoster,
  sortPlayersByRoster,
} from "@/lib/player-sort";
import { fetchSoloQByRiotId, getRiotApiKey } from "@/lib/riot/soloq";
import type { SoloQAccountResult, SoloQStatsPayload } from "@/lib/riot/types";
import type { PlayerRegion } from "@/lib/player-accounts-shared";
import type { LoLRole, UserRole } from "@prisma/client";

const TIER_ORDER = [
  "CHALLENGER",
  "GRANDMASTER",
  "MASTER",
  "DIAMOND",
  "EMERALD",
  "PLATINUM",
  "GOLD",
  "SILVER",
  "BRONZE",
  "IRON",
] as const;

const DIVISION_ORDER = ["I", "II", "III", "IV"] as const;

export function soloqSortScore(result: SoloQAccountResult): number {
  if (result.status !== "ok" || !result.soloq) return -1;
  const tier = TIER_ORDER.indexOf(
    result.soloq.tier.toUpperCase() as (typeof TIER_ORDER)[number],
  );
  const division = DIVISION_ORDER.indexOf(
    result.soloq.rank.toUpperCase() as (typeof DIVISION_ORDER)[number],
  );
  const tierScore = tier === -1 ? 50 : TIER_ORDER.length - tier;
  const divScore = division === -1 ? 0 : DIVISION_ORDER.length - division;
  return tierScore * 10000 + divScore * 1000 + result.soloq.leaguePoints;
}

export function formatSoloQRank(soloq: {
  tier: string;
  rank: string;
  leaguePoints: number;
}): string {
  const tier = soloq.tier.charAt(0) + soloq.tier.slice(1).toLowerCase();
  if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(soloq.tier.toUpperCase())) {
    return `${tier} ${soloq.leaguePoints} LP`;
  }
  return `${tier} ${soloq.rank} · ${soloq.leaguePoints} LP`;
}

export type SoloQPlayerSummary = {
  playerId: string;
  displayName: string;
  teamRole: string;
  memberRole: string;
  accounts: SoloQAccountResult[];
  /** Highest-ranked account (or first if none ranked). */
  best: SoloQAccountResult;
  combinedWins: number;
  combinedLosses: number;
};

/** One summary row per player, ordered like the Players roster (lane, Fill last). */
export function groupSoloQByPlayer(
  results: SoloQAccountResult[],
): SoloQPlayerSummary[] {
  const byPlayer = new Map<string, SoloQAccountResult[]>();
  for (const row of results) {
    const list = byPlayer.get(row.playerId);
    if (list) list.push(row);
    else byPlayer.set(row.playerId, [row]);
  }

  const summaries: SoloQPlayerSummary[] = [];
  for (const accounts of byPlayer.values()) {
    const sorted = [...accounts].sort(
      (a, b) => soloqSortScore(b) - soloqSortScore(a),
    );
    const best = sorted[0]!;
    let combinedWins = 0;
    let combinedLosses = 0;
    for (const account of accounts) {
      if (account.soloq) {
        combinedWins += account.soloq.wins;
        combinedLosses += account.soloq.losses;
      }
    }
    summaries.push({
      playerId: best.playerId,
      displayName: best.displayName,
      teamRole: best.teamRole,
      memberRole: best.memberRole,
      accounts: sorted,
      best,
      combinedWins,
      combinedLosses,
    });
  }

  summaries.sort((a, b) =>
    comparePlayersByRoster(
      {
        teamRole: a.teamRole as LoLRole,
        memberRole: a.memberRole as UserRole,
        displayName: a.displayName,
      },
      {
        teamRole: b.teamRole as LoLRole,
        memberRole: b.memberRole as UserRole,
        displayName: b.displayName,
      },
    ),
  );
  return summaries;
}

export async function loadSoloQRosterStats(opts?: {
  bypassCache?: boolean;
}): Promise<SoloQStatsPayload> {
  const apiKey = getRiotApiKey();
  const players = sortPlayersByRoster(
    await prisma.player.findMany({
      where: activeTeamPlayerWhere,
      include: {
        accounts: { orderBy: [{ region: "asc" }, { createdAt: "asc" }] },
      },
    }),
  );

  const fetchedAt = new Date().toISOString();

  if (!apiKey) {
    const results: SoloQAccountResult[] = players.flatMap((player) => {
      const accounts =
        player.accounts.length > 0
          ? player.accounts
          : player.summonerName
            ? [
                {
                  id: `legacy-${player.id}`,
                  region: "WEST" as PlayerRegion,
                  summonerName: player.summonerName,
                },
              ]
            : [];

      return accounts.map((account) => ({
        playerId: player.id,
        displayName: player.displayName,
        teamRole: player.teamRole,
        memberRole: player.memberRole,
        accountId: account.id,
        region: account.region as PlayerRegion,
        summonerName: account.summonerName,
        status: "missing_key" as const,
        soloq: null,
        error: "Set RIOT_API_KEY in the environment",
      }));
    });

    return { fetchedAt, hasApiKey: false, results };
  }

  const jobs = players.flatMap((player) => {
    const accounts =
      player.accounts.length > 0
        ? player.accounts
        : player.summonerName
          ? [
              {
                id: `legacy-${player.id}`,
                region: "WEST" as const,
                summonerName: player.summonerName,
                puuid: null as string | null,
              },
            ]
          : [];

    return accounts.map(async (account) => {
      const region = account.region as PlayerRegion;
      const fetched = await fetchSoloQByRiotId(
        account.summonerName,
        region,
        apiKey,
        opts,
      );

      const base = {
        playerId: player.id,
        displayName: player.displayName,
        teamRole: player.teamRole,
        memberRole: player.memberRole,
        accountId: account.id,
        region,
        summonerName: account.summonerName,
      };

      if (fetched.status === "ok" || fetched.status === "unranked") {
        if (!account.id.startsWith("legacy-")) {
          const { syncAccountRankSnapshot } = await import(
            "@/lib/stats/soloq-advanced-sync"
          );
          await syncAccountRankSnapshot({
            accountId: account.id,
            summonerName: account.summonerName,
            region,
            puuid: account.puuid ?? null,
            soloq: fetched.status === "ok" ? fetched.soloq : null,
            resolvedPuuid: fetched.puuid,
          }).catch(() => {
            /* rank snapshot is best-effort on roster refresh */
          });
        }
      }

      if (fetched.status === "ok") {
        return { ...base, status: "ok" as const, soloq: fetched.soloq };
      }
      if (fetched.status === "unranked") {
        return { ...base, status: "unranked" as const, soloq: null };
      }
      return {
        ...base,
        status: "error" as const,
        soloq: null,
        error: fetched.message,
      };
    });
  });

  const settled = await Promise.all(jobs);
  const playerOrder = new Map(players.map((p, i) => [p.id, i]));
  settled.sort((a, b) => {
    const orderDiff =
      (playerOrder.get(a.playerId) ?? 999) - (playerOrder.get(b.playerId) ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return soloqSortScore(b) - soloqSortScore(a);
  });

  return { fetchedAt, hasApiKey: true, results: settled };
}
