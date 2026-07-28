import type { PlayerRegion } from "@/lib/player-accounts-shared";
import {
  parseRiotId,
  platformHost,
  regionalRoutingHost,
  riotFetch,
  sleep,
} from "@/lib/riot/client";
import type { SoloQRank } from "@/lib/riot/types";

/**
 * Queue IDs allowed for SoloQ advanced metrics.
 * Never custom / practice / LCU scrims — Match-V5 cannot cover those.
 */
export const SOLOQ_ALLOWED_QUEUE_IDS = new Set([
  420, // Ranked Solo/Duo
  440, // Ranked Flex
  400, // Normal Draft
]);

export const SOLOQ_MATCH_SYNC_COUNT = 25;
/** Delay between Match-V5 detail calls to ease rate limits. */
export const MATCH_DETAIL_DELAY_MS = 80;

type AccountDto = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

type LeagueEntryDto = {
  queueType: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
  hotStreak?: boolean;
};

type MatchDto = {
  metadata: { matchId: string; participants: string[] };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameVersion: string;
    queueId: number;
    participants: Array<{
      puuid: string;
      championName: string;
      win: boolean;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
      goldEarned: number;
      totalDamageDealtToChampions: number;
      teamId: number;
      teamPosition?: string;
      individualPosition?: string;
    }>;
  };
};

export type SoloQMatchExtract = {
  matchId: string;
  playedAt: Date;
  queueId: number;
  gameVersion: string;
  champion: string;
  win: boolean;
  cs: number;
  gold: number;
  damage: number;
  durationSec: number;
  teamDamage: number;
  role: string | null;
};

export async function resolvePuuidByRiotId(
  summonerName: string,
  region: PlayerRegion,
  apiKey: string,
  opts?: { bypassCache?: boolean },
): Promise<
  | { status: "ok"; puuid: string }
  | { status: "error"; message: string }
> {
  const parsed = parseRiotId(summonerName);
  if (!parsed) {
    return { status: "error", message: "Invalid Riot ID (use Name#TAG)" };
  }

  const accountUrl =
    `https://${regionalRoutingHost(region)}/riot/account/v1/accounts/by-riot-id/` +
    `${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`;

  const account = await riotFetch<AccountDto>(accountUrl, apiKey, opts);
  if (!account.ok) {
    return { status: "error", message: account.message };
  }
  return { status: "ok", puuid: account.data.puuid };
}

export async function fetchSoloQEntryByPuuid(
  puuid: string,
  region: PlayerRegion,
  apiKey: string,
  opts?: { bypassCache?: boolean },
): Promise<
  | { status: "ok"; soloq: SoloQRank }
  | { status: "unranked" }
  | { status: "error"; message: string }
> {
  const leagueUrl =
    `https://${platformHost(region)}/lol/league/v4/entries/by-puuid/` +
    `${encodeURIComponent(puuid)}`;

  const league = await riotFetch<LeagueEntryDto[]>(leagueUrl, apiKey, opts);
  if (!league.ok) {
    if (league.status === 404) return { status: "unranked" };
    return { status: "error", message: league.message };
  }

  const solo = league.data.find((e) => e.queueType === "RANKED_SOLO_5x5");
  if (!solo?.tier || !solo.rank) {
    return { status: "unranked" };
  }

  return {
    status: "ok",
    soloq: {
      tier: solo.tier,
      rank: solo.rank,
      leaguePoints: solo.leaguePoints ?? 0,
      wins: solo.wins ?? 0,
      losses: solo.losses ?? 0,
      hotStreak: Boolean(solo.hotStreak),
    },
  };
}

/** Recent match IDs for a puuid (Europe routing). */
export async function fetchMatchIdsByPuuid(
  puuid: string,
  region: PlayerRegion,
  apiKey: string,
  opts?: { count?: number; bypassCache?: boolean },
): Promise<
  { status: "ok"; matchIds: string[] } | { status: "error"; message: string }
> {
  const count = opts?.count ?? SOLOQ_MATCH_SYNC_COUNT;
  const url =
    `https://${regionalRoutingHost(region)}/lol/match/v5/matches/by-puuid/` +
    `${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;

  const result = await riotFetch<string[]>(url, apiKey, {
    bypassCache: opts?.bypassCache ?? true,
  });
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  return { status: "ok", matchIds: result.data };
}

export async function fetchMatchById(
  matchId: string,
  region: PlayerRegion,
  apiKey: string,
  opts?: { bypassCache?: boolean },
): Promise<
  { status: "ok"; match: MatchDto } | { status: "error"; message: string }
> {
  const url =
    `https://${regionalRoutingHost(region)}/lol/match/v5/matches/` +
    `${encodeURIComponent(matchId)}`;

  const result = await riotFetch<MatchDto>(url, apiKey, {
    bypassCache: opts?.bypassCache ?? true,
  });
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  return { status: "ok", match: result.data };
}

/**
 * Extract ladder stats for one puuid from a Match-V5 payload.
 * Returns null when queue is not allowed (customs etc.) or participant missing.
 */
export function extractSoloQMatchForPuuid(
  match: MatchDto,
  puuid: string,
): SoloQMatchExtract | null {
  const queueId = match.info.queueId;
  if (!SOLOQ_ALLOWED_QUEUE_IDS.has(queueId)) return null;

  const me = match.info.participants.find((p) => p.puuid === puuid);
  if (!me) return null;

  const teamDamage = match.info.participants
    .filter((p) => p.teamId === me.teamId)
    .reduce((sum, p) => sum + (p.totalDamageDealtToChampions ?? 0), 0);

  const durationSec =
    match.info.gameDuration > 10_000
      ? Math.round(match.info.gameDuration / 1000)
      : match.info.gameDuration;

  const role =
    me.teamPosition?.trim() ||
    me.individualPosition?.trim() ||
    null;

  return {
    matchId: match.metadata.matchId,
    playedAt: new Date(match.info.gameCreation),
    queueId,
    gameVersion: match.info.gameVersion,
    champion: me.championName || "Unknown",
    win: Boolean(me.win),
    cs: (me.totalMinionsKilled ?? 0) + (me.neutralMinionsKilled ?? 0),
    gold: me.goldEarned ?? 0,
    damage: me.totalDamageDealtToChampions ?? 0,
    durationSec: Math.max(1, durationSec),
    teamDamage,
    role: role && role !== "Invalid" ? role : null,
  };
}

/** Fetch match IDs then details; skips disallowed queues; paces requests. */
export async function fetchSoloQMatchExtracts(
  puuid: string,
  region: PlayerRegion,
  apiKey: string,
  opts?: {
    count?: number;
    knownMatchIds?: Set<string>;
    onRateLimit?: () => void;
  },
): Promise<
  | { status: "ok"; matches: SoloQMatchExtract[]; errors: string[] }
  | { status: "error"; message: string }
> {
  const idsResult = await fetchMatchIdsByPuuid(puuid, region, apiKey, {
    count: opts?.count ?? SOLOQ_MATCH_SYNC_COUNT,
    bypassCache: true,
  });
  if (idsResult.status === "error") {
    return idsResult;
  }

  const known = opts?.knownMatchIds ?? new Set<string>();
  const toFetch = idsResult.matchIds.filter((id) => !known.has(id));
  const matches: SoloQMatchExtract[] = [];
  const errors: string[] = [];

  for (let i = 0; i < toFetch.length; i++) {
    const matchId = toFetch[i]!;
    if (i > 0) await sleep(MATCH_DETAIL_DELAY_MS);

    const detail = await fetchMatchById(matchId, region, apiKey, {
      bypassCache: true,
    });
    if (detail.status === "error") {
      if (detail.message.includes("rate limit")) {
        opts?.onRateLimit?.();
      }
      errors.push(`${matchId}: ${detail.message}`);
      // Stop early on hard rate limit to avoid cascading failures.
      if (detail.message.includes("rate limit")) break;
      continue;
    }

    const extracted = extractSoloQMatchForPuuid(detail.match, puuid);
    if (extracted) matches.push(extracted);
  }

  return { status: "ok", matches, errors };
}
