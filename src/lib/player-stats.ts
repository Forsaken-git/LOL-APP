import type { LoLRole, MatchResult, UserRole } from "@prisma/client";
import type {
  ChampionPoolEntry,
  CombatSummary,
  PlayerAccountEntry,
  PlayerProfile,
  PlayerRecord,
} from "@/lib/player-profile-types";
import { primarySummonerName } from "@/lib/player-accounts-shared";

export type {
  ChampionPoolEntry,
  CombatSummary,
  MemberRole,
  PlayerProfile,
  PlayerRecord,
  TeamRole,
} from "@/lib/player-profile-types";

export { formatTeamRole, rosterLabel } from "@/lib/player-display";

export type ParticipationWithMatch = {
  champion: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  match: { playedAt: Date; result: MatchResult | null };
};

/** Shrinkage toward the player's overall win rate (stabilizes small samples). */
const COMBINED_WR_PRIOR_GAMES = 5;

export function computePlayerRecord(parts: ParticipationWithMatch[]): PlayerRecord {
  const played = parts.filter((p) => p.match.result != null);
  const games = played.length;
  const wins = played.filter((p) => p.match.result === "WIN").length;
  const losses = games - wins;
  return {
    games,
    wins,
    losses,
    winRate: games ? Math.round((wins / games) * 100) : 0,
  };
}

/** Per-champion WR adjusted toward the player's overall win rate. */
export function computeCombinedWinRate(
  wins: number,
  games: number,
  overall: Pick<PlayerRecord, "wins" | "games">,
): number {
  if (games === 0) return 0;
  const priorRate = overall.games > 0 ? overall.wins / overall.games : 0.5;
  const adjusted =
    (wins + priorRate * COMBINED_WR_PRIOR_GAMES) /
    (games + COMBINED_WR_PRIOR_GAMES);
  return Math.round(adjusted * 100);
}

export function kdaRatio(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return kills + assists;
  return (kills + assists) / deaths;
}

export function formatKdaRatio(ratio: number): string {
  return ratio.toFixed(2);
}

export function formatKdaLine(kills: number, deaths: number, assists: number): string {
  return `${kills}/${deaths}/${assists}`;
}

export function computeCombatTotals(
  parts: Pick<ParticipationWithMatch, "kills" | "deaths" | "assists">[],
): { kills: number; deaths: number; assists: number; gamesWithStats: number } {
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let gamesWithStats = 0;

  for (const p of parts) {
    if (p.kills == null || p.deaths == null || p.assists == null) continue;
    gamesWithStats++;
    kills += p.kills;
    deaths += p.deaths;
    assists += p.assists;
  }

  return { kills, deaths, assists, gamesWithStats };
}

/** Combat stats for one champion only (that champion's games, not mixed with others). */
export function computeCombatSummary(
  parts: ParticipationWithMatch[],
): CombatSummary | null {
  const { kills, deaths, assists, gamesWithStats } = computeCombatTotals(parts);
  if (gamesWithStats === 0) return null;

  const ratio = kdaRatio(kills, deaths, assists);
  const avgK = kills / gamesWithStats;
  const avgD = deaths / gamesWithStats;
  const avgA = assists / gamesWithStats;

  return {
    kills,
    deaths,
    assists,
    kdaLine: formatKdaAverages(avgK, avgD, avgA),
    kdaRatio: ratio,
    kdaRatioLabel: formatKdaRatio(ratio),
  };
}

function formatKdaAverages(k: number, d: number, a: number): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(k)}/${fmt(d)}/${fmt(a)}`;
}

export function buildChampionPool(
  parts: ParticipationWithMatch[],
  overall: PlayerRecord,
): ChampionPoolEntry[] {
  const byChampion = new Map<string, ParticipationWithMatch[]>();

  for (const p of parts) {
    const list = byChampion.get(p.champion) ?? [];
    list.push(p);
    byChampion.set(p.champion, list);
  }

  return [...byChampion.entries()]
    .map(([champion, champParts]) => {
      const record = computePlayerRecord(champParts);
      return {
        champion,
        ...record,
        combinedWinRate: computeCombinedWinRate(
          record.wins,
          record.games,
          overall,
        ),
        combat: computeCombatSummary(champParts),
      };
    })
    .sort((a, b) => b.games - a.games || a.champion.localeCompare(b.champion));
}

/** Most recently played champions (unique), newest first. */
export function recentChampions(
  parts: ParticipationWithMatch[],
  limit = 6,
): string[] {
  const sorted = [...parts].sort(
    (a, b) => b.match.playedAt.getTime() - a.match.playedAt.getTime(),
  );
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of sorted) {
    if (seen.has(p.champion)) continue;
    seen.add(p.champion);
    result.push(p.champion);
    if (result.length >= limit) break;
  }
  return result;
}

function resolveAccounts(
  accounts: {
    id?: string;
    region: PlayerAccountEntry["region"];
    summonerName: string;
  }[],
  legacySummonerName: string | null,
): PlayerAccountEntry[] {
  if (accounts.length > 0) {
    return accounts.map((a) => ({
      id: a.id,
      region: a.region,
      summonerName: a.summonerName,
    }));
  }
  if (legacySummonerName) {
    return [{ region: "WEST", summonerName: legacySummonerName }];
  }
  return [];
}

export function buildPlayerProfile(
  player: {
    id: string;
    displayName: string;
    summonerName: string | null;
    teamRole: LoLRole;
    memberRole: UserRole;
    active?: boolean;
    accounts?: {
      id?: string;
      region: PlayerAccountEntry["region"];
      summonerName: string;
    }[];
    participations: ParticipationWithMatch[];
  },
): PlayerProfile {
  const { participations } = player;
  const overall = computePlayerRecord(participations);
  const accounts = resolveAccounts(player.accounts ?? [], player.summonerName);
  return {
    id: player.id,
    displayName: player.displayName,
    summonerName: primarySummonerName(accounts, player.summonerName),
    teamRole: player.teamRole,
    memberRole: player.memberRole,
    active: player.active ?? true,
    accounts,
    totalGames: participations.length,
    overall,
    champions: buildChampionPool(participations, overall),
    recent: recentChampions(participations),
  };
}
