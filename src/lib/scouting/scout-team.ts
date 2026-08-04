import type { PlayerRegion } from "@/lib/player-accounts-shared";
import {
  getRiotApiKey,
  regionalRoutingHost,
  riotFetch,
  sleep,
} from "@/lib/riot/client";
import {
  fetchMatchIdsByPuuid,
  fetchSoloQEntryByPuuid,
  MATCH_DETAIL_DELAY_MS,
  resolvePuuidByRiotId,
} from "@/lib/riot/match-v5";
import type { SoloQRank } from "@/lib/riot/types";
import type {
  ScoutingChampionStat,
  ScoutingPlayerResult,
  ScoutingReport,
} from "@/lib/scouting/types";

/** Ranked Solo + Flex only for scouting samples. */
const SCOUTING_RANKED_QUEUE_IDS = new Set([420, 440]);
export const SCOUTING_MATCH_COUNT = 20;
const TOP_CHAMPIONS = 5;

type ScoutMatchDto = {
  metadata: { matchId: string };
  info: {
    queueId: number;
    participants: Array<{
      puuid: string;
      championName: string;
      win: boolean;
      kills?: number;
      deaths?: number;
      assists?: number;
    }>;
  };
};

type MatchExtract = {
  champion: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
};

function kdaRatio(kills: number, deaths: number, assists: number): number {
  const d = deaths <= 0 ? 1 : deaths;
  return Math.round(((kills + assists) / d) * 100) / 100;
}

function winRate(wins: number, games: number): number {
  if (games <= 0) return 0;
  return Math.round((wins / games) * 1000) / 10;
}

async function fetchScoutMatchById(
  matchId: string,
  region: PlayerRegion,
  apiKey: string,
): Promise<
  { status: "ok"; match: ScoutMatchDto } | { status: "error"; message: string }
> {
  const url =
    `https://${regionalRoutingHost(region)}/lol/match/v5/matches/` +
    `${encodeURIComponent(matchId)}`;
  const result = await riotFetch<ScoutMatchDto>(url, apiKey, {
    bypassCache: true,
  });
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  return { status: "ok", match: result.data };
}

function extractRankedMatch(
  match: ScoutMatchDto,
  puuid: string,
): MatchExtract | null {
  if (!SCOUTING_RANKED_QUEUE_IDS.has(match.info.queueId)) return null;
  const me = match.info.participants.find((p) => p.puuid === puuid);
  if (!me) return null;
  return {
    champion: me.championName || "Unknown",
    win: Boolean(me.win),
    kills: me.kills ?? 0,
    deaths: me.deaths ?? 0,
    assists: me.assists ?? 0,
  };
}

async function fetchRankedExtracts(
  puuid: string,
  region: PlayerRegion,
  apiKey: string,
): Promise<
  | { status: "ok"; matches: MatchExtract[]; errors: string[] }
  | { status: "error"; message: string }
> {
  const idsResult = await fetchMatchIdsByPuuid(puuid, region, apiKey, {
    count: SCOUTING_MATCH_COUNT,
    bypassCache: true,
  });
  if (idsResult.status === "error") return idsResult;

  const matches: MatchExtract[] = [];
  const errors: string[] = [];

  for (let i = 0; i < idsResult.matchIds.length; i++) {
    const matchId = idsResult.matchIds[i]!;
    if (i > 0) await sleep(MATCH_DETAIL_DELAY_MS);

    const detail = await fetchScoutMatchById(matchId, region, apiKey);
    if (detail.status === "error") {
      errors.push(`${matchId}: ${detail.message}`);
      if (detail.message.includes("rate limit")) break;
      continue;
    }

    const extracted = extractRankedMatch(detail.match, puuid);
    if (extracted) matches.push(extracted);
  }

  return { status: "ok", matches, errors };
}

function aggregateChampions(matches: MatchExtract[]): ScoutingChampionStat[] {
  const byChamp = new Map<
    string,
    { games: number; wins: number; kills: number; deaths: number; assists: number }
  >();

  for (const m of matches) {
    const cur = byChamp.get(m.champion) ?? {
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    };
    cur.games += 1;
    if (m.win) cur.wins += 1;
    cur.kills += m.kills;
    cur.deaths += m.deaths;
    cur.assists += m.assists;
    byChamp.set(m.champion, cur);
  }

  return [...byChamp.entries()]
    .map(([champion, s]) => ({
      champion,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
      winRate: winRate(s.wins, s.games),
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      kda: kdaRatio(s.kills, s.deaths, s.assists),
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
    .slice(0, TOP_CHAMPIONS);
}

function emptyOkPlayer(
  riotId: string,
  region: PlayerRegion,
  soloq: SoloQRank | null,
): ScoutingPlayerResult {
  return {
    riotId,
    region,
    status: "ok",
    soloq,
    recentGames: 0,
    recentWins: 0,
    recentLosses: 0,
    recentWinRate: 0,
    recentKills: 0,
    recentDeaths: 0,
    recentAssists: 0,
    recentKda: 0,
    champions: [],
  };
}

async function scoutOnePlayer(
  riotId: string,
  region: PlayerRegion,
  apiKey: string,
): Promise<ScoutingPlayerResult> {
  const resolved = await resolvePuuidByRiotId(riotId, region, apiKey, {
    bypassCache: true,
  });
  if (resolved.status === "error") {
    return {
      ...emptyOkPlayer(riotId, region, null),
      status: "error",
      error: resolved.message,
    };
  }

  const rank = await fetchSoloQEntryByPuuid(resolved.puuid, region, apiKey, {
    bypassCache: true,
  });
  const soloq = rank.status === "ok" ? rank.soloq : null;
  if (rank.status === "error") {
    // Rank failure is non-fatal; continue with matches.
  }

  const extracts = await fetchRankedExtracts(resolved.puuid, region, apiKey);
  if (extracts.status === "error") {
    return {
      ...emptyOkPlayer(riotId, region, soloq),
      status: "error",
      error: extracts.message,
    };
  }

  const wins = extracts.matches.filter((m) => m.win).length;
  const games = extracts.matches.length;
  const kills = extracts.matches.reduce((s, m) => s + m.kills, 0);
  const deaths = extracts.matches.reduce((s, m) => s + m.deaths, 0);
  const assists = extracts.matches.reduce((s, m) => s + m.assists, 0);

  return {
    riotId,
    region,
    status: "ok",
    soloq,
    recentGames: games,
    recentWins: wins,
    recentLosses: games - wins,
    recentWinRate: winRate(wins, games),
    recentKills: kills,
    recentDeaths: deaths,
    recentAssists: assists,
    recentKda: kdaRatio(kills, deaths, assists),
    champions: aggregateChampions(extracts.matches),
    ...(extracts.errors.length > 0
      ? {
          error:
            extracts.errors.some((e) => e.includes("rate limit"))
              ? "Partial data — Riot API rate limit hit"
              : undefined,
        }
      : {}),
  };
}

export async function scoutTeam(opts: {
  region: PlayerRegion;
  riotIds: string[];
  warnings?: string[];
}): Promise<ScoutingReport> {
  const apiKey = getRiotApiKey();
  const warnings = [...(opts.warnings ?? [])];

  if (!apiKey) {
    return {
      region: opts.region,
      fetchedAt: new Date().toISOString(),
      hasApiKey: false,
      sampleSize: SCOUTING_MATCH_COUNT,
      players: opts.riotIds.map((riotId) => ({
        ...emptyOkPlayer(riotId, opts.region, null),
        status: "error" as const,
        error: "RIOT_API_KEY is not configured",
      })),
      warnings: [
        ...warnings,
        "Set RIOT_API_KEY in .env or host env vars to scout.",
      ],
    };
  }

  const players: ScoutingPlayerResult[] = [];
  for (let i = 0; i < opts.riotIds.length; i++) {
    const riotId = opts.riotIds[i]!;
    if (i > 0) await sleep(MATCH_DETAIL_DELAY_MS);
    players.push(await scoutOnePlayer(riotId, opts.region, apiKey));
  }

  return {
    region: opts.region,
    fetchedAt: new Date().toISOString(),
    hasApiKey: true,
    sampleSize: SCOUTING_MATCH_COUNT,
    players,
    warnings,
  };
}
