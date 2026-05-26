import { format } from "date-fns";
import type { MatchResult, Side } from "@prisma/client";

export type MatchForEncounter = {
  id: string;
  playedAt: Date;
  league: string;
  opponent: string | null;
  side: Side;
  result: MatchResult;
};

export type EncounterGame = {
  id: string;
  playedAt: Date;
  league: string;
  opponent: string | null;
  side: Side;
  result: MatchResult;
  seriesState: string;
};

export type EncounterSummary = {
  key: string;
  league: string;
  opponent: string | null;
  playedAt: Date;
  wins: number;
  losses: number;
  score: string;
  seriesResult: MatchResult | "DRAW";
  gameCount: number;
  games: EncounterGame[];
};

export function encounterKey(
  m: Pick<MatchForEncounter, "league" | "opponent" | "playedAt">,
): string {
  const opp = (m.opponent ?? "").trim().toLowerCase() || "_unknown_";
  return `${m.league}|${opp}|${format(m.playedAt, "yyyy-MM-dd")}`;
}

export function computeSeriesStates(games: MatchForEncounter[]): EncounterGame[] {
  const ordered = [...games].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime(),
  );
  let wins = 0;
  let losses = 0;
  return ordered.map((g) => {
    if (g.result === "WIN") wins++;
    else losses++;
    return { ...g, seriesState: `${wins}:${losses}` };
  });
}

function groupIntoEncounters(matches: MatchForEncounter[]): Map<string, MatchForEncounter[]> {
  const map = new Map<string, MatchForEncounter[]>();
  for (const m of matches) {
    const key = encounterKey(m);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return map;
}

export function buildEncounterSummaries(
  matches: MatchForEncounter[],
  limit?: number,
): EncounterSummary[] {
  const groups = groupIntoEncounters(matches);

  const summaries: EncounterSummary[] = [...groups.entries()].map(([key, games]) => {
    const encounterGames = computeSeriesStates(games);
    const wins = encounterGames.filter((g) => g.result === "WIN").length;
    const losses = encounterGames.length - wins;
    const latest = games.reduce((a, b) => (a.playedAt > b.playedAt ? a : b));
    const seriesResult: EncounterSummary["seriesResult"] =
      wins > losses ? "WIN" : losses > wins ? "LOSS" : "DRAW";

    return {
      key,
      league: latest.league,
      opponent: latest.opponent,
      playedAt: latest.playedAt,
      wins,
      losses,
      score: `${wins}:${losses}`,
      seriesResult,
      gameCount: games.length,
      games: encounterGames,
    };
  });

  summaries.sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  return limit != null ? summaries.slice(0, limit) : summaries;
}
