import type { Match, MatchResult, Side } from "@prisma/client";

export type TeamStats = {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  red: { total: number; wins: number; winRate: number };
  blue: { total: number; wins: number; winRate: number };
};

type ResultCount = { result: MatchResult | null; _count: number };
type SideResultCount = {
  side: Side;
  result: MatchResult | null;
  _count: number;
};

/** Aggregate team stats from Prisma groupBy rows (avoids loading every match). */
export function computeTeamStatsFromGroupBy(
  resultCounts: ResultCount[],
  sideResultCounts: SideResultCount[],
): TeamStats {
  let wins = 0;
  let losses = 0;
  for (const row of resultCounts) {
    if (row.result === "WIN") wins += row._count;
    else if (row.result === "LOSS") losses += row._count;
  }
  const total = wins + losses;

  let blueTotal = 0;
  let blueWins = 0;
  let redTotal = 0;
  let redWins = 0;
  for (const row of sideResultCounts) {
    if (row.side === "BLUE") {
      blueTotal += row._count;
      if (row.result === "WIN") blueWins += row._count;
    } else if (row.side === "RED") {
      redTotal += row._count;
      if (row.result === "WIN") redWins += row._count;
    }
  }

  return {
    total,
    wins,
    losses,
    winRate: total ? Math.round((wins / total) * 100) : 0,
    blue: {
      total: blueTotal,
      wins: blueWins,
      winRate: blueTotal ? Math.round((blueWins / blueTotal) * 100) : 0,
    },
    red: {
      total: redTotal,
      wins: redWins,
      winRate: redTotal ? Math.round((redWins / redTotal) * 100) : 0,
    },
  };
}

export function computeTeamStats(
  matches: Pick<Match, "result" | "side">[],
): TeamStats {
  const played = matches.filter((m) => m.result != null);
  const wins = played.filter((m) => m.result === "WIN").length;
  const losses = played.length - wins;

  const redMatches = played.filter((m) => m.side === "RED");
  const blueMatches = played.filter((m) => m.side === "BLUE");

  const redWins = redMatches.filter((m) => m.result === "WIN").length;
  const blueWins = blueMatches.filter((m) => m.result === "WIN").length;

  return {
    total: played.length,
    wins,
    losses,
    winRate: played.length ? Math.round((wins / played.length) * 100) : 0,
    red: {
      total: redMatches.length,
      wins: redWins,
      winRate: redMatches.length
        ? Math.round((redWins / redMatches.length) * 100)
        : 0,
    },
    blue: {
      total: blueMatches.length,
      wins: blueWins,
      winRate: blueMatches.length
        ? Math.round((blueWins / blueMatches.length) * 100)
        : 0,
    },
  };
}

export function formatResult(result: MatchResult): string {
  return result === "WIN" ? "Victory" : "Defeat";
}

export function sideLabel(side: Side): string {
  return side === "RED" ? "Red Side" : "Blue Side";
}
