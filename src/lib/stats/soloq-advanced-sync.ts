import { prisma } from "@/lib/prisma";
import { getRiotApiKey } from "@/lib/riot/client";
import {
  fetchSoloQEntryByPuuid,
  fetchSoloQMatchExtracts,
  resolvePuuidByRiotId,
  SOLOQ_MATCH_SYNC_COUNT,
} from "@/lib/riot/match-v5";
import type { PlayerRegion } from "@/lib/player-accounts-shared";
import type { SoloQRank } from "@/lib/riot/types";
import { aggregateSoloQAdvanced } from "@/lib/stats/soloq-advanced";
import type { SoloQAdvancedMetrics } from "@/lib/stats/soloq-advanced-types";

async function ensurePuuid(
  account: {
    id: string;
    puuid: string | null;
    summonerName: string;
    region: PlayerRegion;
  },
  apiKey: string,
): Promise<{ puuid: string } | { error: string }> {
  if (account.puuid) return { puuid: account.puuid };

  const resolved = await resolvePuuidByRiotId(
    account.summonerName,
    account.region,
    apiKey,
    { bypassCache: true },
  );
  if (resolved.status === "error") {
    return { error: resolved.message };
  }

  await prisma.playerAccount.update({
    where: { id: account.id },
    data: { puuid: resolved.puuid },
  });
  return { puuid: resolved.puuid };
}

/** Append a rank snapshot when tier/rank/LP changed vs last row. */
export async function maybeWriteRankSnapshot(
  accountId: string,
  soloq: SoloQRank,
): Promise<void> {
  const last = await prisma.soloQRankSnapshot.findFirst({
    where: { accountId },
    orderBy: { capturedAt: "desc" },
  });

  if (
    last &&
    last.tier === soloq.tier &&
    last.rank === soloq.rank &&
    last.lp === soloq.leaguePoints
  ) {
    return;
  }

  await prisma.soloQRankSnapshot.create({
    data: {
      accountId,
      tier: soloq.tier,
      rank: soloq.rank,
      lp: soloq.leaguePoints,
      wins: soloq.wins,
      losses: soloq.losses,
    },
  });
}

/**
 * Persist puuid + optional LP snapshot for one roster account (used by Stats refresh).
 * Does not pull Match-V5 history (rate-limit heavy) — that is per-player sync.
 */
export async function syncAccountRankSnapshot(input: {
  accountId: string;
  summonerName: string;
  region: PlayerRegion;
  puuid?: string | null;
  soloq: SoloQRank | null;
  resolvedPuuid?: string | null;
}): Promise<void> {
  if (input.accountId.startsWith("legacy-")) return;

  const puuid = input.resolvedPuuid ?? input.puuid;
  if (puuid && !input.puuid) {
    await prisma.playerAccount.update({
      where: { id: input.accountId },
      data: { puuid },
    });
  } else if (puuid && input.puuid !== puuid) {
    await prisma.playerAccount.update({
      where: { id: input.accountId },
      data: { puuid },
    });
  }

  if (input.soloq) {
    await maybeWriteRankSnapshot(input.accountId, input.soloq);
  }
}

export type SoloQAdvancedSyncResult = {
  metrics: SoloQAdvancedMetrics;
  syncedMatches: number;
  errors: string[];
};

/** Sync Match-V5 summaries + latest rank snapshot for all accounts on a player. */
export async function syncPlayerSoloQAdvanced(
  playerId: string,
): Promise<
  | { ok: true; result: SoloQAdvancedSyncResult }
  | { ok: false; error: string; status: number }
> {
  const apiKey = getRiotApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "Set RIOT_API_KEY in the environment",
      status: 503,
    };
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      accounts: { orderBy: [{ region: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!player) {
    return { ok: false, error: "Player not found", status: 404 };
  }
  if (player.accounts.length === 0) {
    return { ok: false, error: "Player has no Riot accounts", status: 400 };
  }

  const errors: string[] = [];
  let syncedMatches = 0;

  for (const account of player.accounts) {
    const region = account.region as PlayerRegion;
    const puuidResult = await ensurePuuid(
      {
        id: account.id,
        puuid: account.puuid,
        summonerName: account.summonerName,
        region,
      },
      apiKey,
    );
    if ("error" in puuidResult) {
      errors.push(`${account.summonerName}: ${puuidResult.error}`);
      continue;
    }

    const entry = await fetchSoloQEntryByPuuid(
      puuidResult.puuid,
      region,
      apiKey,
      { bypassCache: true },
    );
    if (entry.status === "ok") {
      await maybeWriteRankSnapshot(account.id, entry.soloq);
    } else if (entry.status === "error") {
      errors.push(`${account.summonerName} rank: ${entry.message}`);
    }

    const existing = await prisma.soloQMatchSummary.findMany({
      where: { accountId: account.id },
      select: { matchId: true, visionScore: true, controlWardsBought: true },
    });
    // Re-fetch rows missing vision fields after schema upgrades.
    const known = new Set(
      existing
        .filter((m) => m.visionScore != null && m.controlWardsBought != null)
        .map((m) => m.matchId),
    );

    const fetched = await fetchSoloQMatchExtracts(
      puuidResult.puuid,
      region,
      apiKey,
      {
        count: SOLOQ_MATCH_SYNC_COUNT,
        knownMatchIds: known,
      },
    );

    if (fetched.status === "error") {
      errors.push(`${account.summonerName} matches: ${fetched.message}`);
      continue;
    }
    errors.push(
      ...fetched.errors.map((e) => `${account.summonerName}: ${e}`),
    );

    for (const match of fetched.matches) {
      await prisma.soloQMatchSummary.upsert({
        where: {
          accountId_matchId: {
            accountId: account.id,
            matchId: match.matchId,
          },
        },
        create: {
          accountId: account.id,
          matchId: match.matchId,
          playedAt: match.playedAt,
          queueId: match.queueId,
          gameVersion: match.gameVersion,
          champion: match.champion,
          win: match.win,
          cs: match.cs,
          gold: match.gold,
          damage: match.damage,
          durationSec: match.durationSec,
          teamDamage: match.teamDamage,
          role: match.role,
          visionScore: match.visionScore,
          controlWardsBought: match.controlWardsBought,
        },
        update: {
          playedAt: match.playedAt,
          queueId: match.queueId,
          gameVersion: match.gameVersion,
          champion: match.champion,
          win: match.win,
          cs: match.cs,
          gold: match.gold,
          damage: match.damage,
          durationSec: match.durationSec,
          teamDamage: match.teamDamage,
          role: match.role,
          visionScore: match.visionScore,
          controlWardsBought: match.controlWardsBought,
          syncedAt: new Date(),
        },
      });
      syncedMatches += 1;
    }
  }

  const metrics = await loadPlayerSoloQAdvanced(playerId);
  return {
    ok: true,
    result: {
      metrics,
      syncedMatches,
      errors,
    },
  };
}

/** Read-only aggregation from SoloQ cache (no LCU / team MatchParticipant). */
export async function loadPlayerSoloQAdvanced(
  playerId: string,
): Promise<SoloQAdvancedMetrics> {
  const accounts = await prisma.playerAccount.findMany({
    where: { playerId },
    orderBy: [{ region: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      region: true,
      summonerName: true,
    },
  });

  const accountIds = accounts.map((a) => a.id);

  const [matches, snapshots] = await Promise.all([
    accountIds.length
      ? prisma.soloQMatchSummary.findMany({
          where: { accountId: { in: accountIds } },
          orderBy: { playedAt: "desc" },
        })
      : Promise.resolve([]),
    accountIds.length
      ? prisma.soloQRankSnapshot.findMany({
          where: { accountId: { in: accountIds } },
          orderBy: { capturedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const lastSyncedAt =
    matches.reduce<Date | null>((latest, m) => {
      if (!latest || m.syncedAt > latest) return m.syncedAt;
      return latest;
    }, null) ??
    snapshots.reduce<Date | null>((latest, s) => {
      if (!latest || s.capturedAt > latest) return s.capturedAt;
      return latest;
    }, null);

  return aggregateSoloQAdvanced({
    accounts: accounts.map((a) => ({
      id: a.id,
      region: a.region as PlayerRegion,
      summonerName: a.summonerName,
    })),
    matches: matches.map((m) => ({
      accountId: m.accountId,
      playedAt: m.playedAt,
      gameVersion: m.gameVersion,
      champion: m.champion,
      win: m.win,
      cs: m.cs,
      gold: m.gold,
      damage: m.damage,
      durationSec: m.durationSec,
      teamDamage: m.teamDamage,
      role: m.role,
      visionScore: m.visionScore,
      controlWardsBought: m.controlWardsBought,
    })),
    snapshots: snapshots.map((s) => ({
      accountId: s.accountId,
      capturedAt: s.capturedAt,
      tier: s.tier,
      rank: s.rank,
      lp: s.lp,
    })),
    lastSyncedAt,
  });
}
