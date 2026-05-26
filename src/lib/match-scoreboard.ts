import type { MatchResult, PickBanType, Side } from "@prisma/client";

export type ScoreboardRow = {
  champion: string;
  summonerName: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  isOurTeam: boolean;
};

export type TeamScoreboard = {
  side: Side;
  won: boolean;
  rows: ScoreboardRow[];
};

export type MatchScoreboardData = {
  matchId: string;
  playedAt: string;
  league: string;
  opponent: string | null;
  result: MatchResult;
  ourSide: Side;
  blue: TeamScoreboard;
  red: TeamScoreboard;
};

type PickBanInput = {
  champion: string;
  type: PickBanType;
  side: Side;
  order: number;
};

type ParticipantInput = {
  champion: string;
  side: Side | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  player: {
    displayName: string;
    summonerName: string | null;
  };
};

type MatchInput = {
  id: string;
  playedAt: Date;
  league: string;
  opponent: string | null;
  result: MatchResult;
  side: Side;
  participants: ParticipantInput[];
  pickBans: PickBanInput[];
};

function kdaString(row: ScoreboardRow): string {
  if (row.kills == null || row.deaths == null || row.assists == null) {
    return "—";
  }
  return `${row.kills}/${row.deaths}/${row.assists}`;
}

export { kdaString };

function picksForSide(pickBans: PickBanInput[], side: Side): string[] {
  return pickBans
    .filter((p) => p.type === "PICK" && p.side === side)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.champion);
}

function participantRow(
  p: ParticipantInput,
  isOurTeam: boolean,
): ScoreboardRow {
  return {
    champion: p.champion,
    summonerName:
      p.player.summonerName?.split("#")[0] ?? p.player.displayName,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    isOurTeam,
  };
}

function pickRow(champion: string): ScoreboardRow {
  return {
    champion,
    summonerName: "—",
    kills: null,
    deaths: null,
    assists: null,
    isOurTeam: false,
  };
}

function orderByPicks(rows: ScoreboardRow[], pickOrder: string[]): ScoreboardRow[] {
  if (pickOrder.length === 0) return rows;
  const order = new Map(pickOrder.map((c, i) => [c, i]));
  return [...rows].sort(
    (a, b) => (order.get(a.champion) ?? 99) - (order.get(b.champion) ?? 99),
  );
}

function teamWon(side: Side, ourSide: Side, result: MatchResult): boolean {
  const weWon = result === "WIN";
  return side === ourSide ? weWon : !weWon;
}

function enemyPickChampions(
  pickBans: PickBanInput[],
  ourChampions: Set<string>,
): string[] {
  return pickBans
    .filter((p) => p.type === "PICK" && !ourChampions.has(p.champion))
    .sort((a, b) => a.order - b.order)
    .map((p) => p.champion);
}

function participantsWithSide(
  participants: ParticipantInput[],
): participants is (ParticipantInput & { side: Side })[] {
  return (
    participants.length > 0 &&
    participants.every((p) => p.side === "BLUE" || p.side === "RED")
  );
}

export function buildMatchScoreboard(match: MatchInput): MatchScoreboardData {
  const ourSide = match.side;
  const bluePickOrder = picksForSide(match.pickBans, "BLUE");
  const redPickOrder = picksForSide(match.pickBans, "RED");
  const ourChampions = new Set(match.participants.map((p) => p.champion));

  let blueRows: ScoreboardRow[];
  let redRows: ScoreboardRow[];

  if (participantsWithSide(match.participants) && match.participants.length >= 8) {
    const blueParts = match.participants.filter((p) => p.side === "BLUE");
    const redParts = match.participants.filter((p) => p.side === "RED");
    blueRows = orderByPicks(
      blueParts.map((p) => participantRow(p, ourSide === "BLUE")),
      bluePickOrder,
    );
    redRows = orderByPicks(
      redParts.map((p) => participantRow(p, ourSide === "RED")),
      redPickOrder,
    );
  } else {
    const ourRows = match.participants.map((p) => participantRow(p, true));
    const enemyChamps = enemyPickChampions(match.pickBans, ourChampions);
    const enemyRows = enemyChamps.map(pickRow);

    if (ourSide === "BLUE") {
      blueRows = orderByPicks(ourRows, bluePickOrder);
      redRows = orderByPicks(enemyRows, redPickOrder);
    } else {
      redRows = orderByPicks(ourRows, redPickOrder);
      blueRows = orderByPicks(enemyRows, bluePickOrder);
    }
  }

  return {
    matchId: match.id,
    playedAt: match.playedAt.toISOString(),
    league: match.league,
    opponent: match.opponent,
    result: match.result,
    ourSide,
    blue: {
      side: "BLUE",
      won: teamWon("BLUE", ourSide, match.result),
      rows: blueRows.slice(0, 5),
    },
    red: {
      side: "RED",
      won: teamWon("RED", ourSide, match.result),
      rows: redRows.slice(0, 5),
    },
  };
}
