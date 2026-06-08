import type { Match, MatchResult, Side } from "@prisma/client";

export type TeamStats = {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  red: { total: number; wins: number; winRate: number };
  blue: { total: number; wins: number; winRate: number };
};

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
