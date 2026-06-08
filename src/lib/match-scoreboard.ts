import type { LoLRole, MatchResult, PickBanType, Side } from "@prisma/client";
import { normalizeParticipantBuild } from "@/lib/build-normalize";
import { parseBuildJson } from "@/lib/items";

export type ScoreboardRow = {
  champion: string;
  summonerName: string;
  role: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  cs: number | null;
  damage: number | null;
  goldEarned: number | null;
  visionScore: number | null;
  position: string | null;
  itemIds: number[];
  questItemId?: number | null;
  trinketItemId?: number | null;
  spell1Id: number | null;
  spell2Id: number | null;
  perks: {
    primaryStyle?: number;
    subStyle?: number;
    slots: number[];
  } | null;
  isOurTeam: boolean;
};

export type TeamScoreboard = {
  side: Side;
  won: boolean | null;
  rows: ScoreboardRow[];
};

export type MatchScoreboardData = {
  matchId: string;
  playedAt: string;
  league: string;
  opponent: string | null;
  result: MatchResult | null;
  ourSide: Side;
  gameDurationSec: number | null;
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
  position: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  cs: number | null;
  damage: number | null;
  goldEarned: number | null;
  visionScore: number | null;
  buildJson: string | null;
  player: {
    displayName: string;
    summonerName: string | null;
    teamRole: LoLRole;
  };
};

type MatchInput = {
  id: string;
  playedAt: Date;
  league: string;
  opponent: string | null;
  result: MatchResult | null;
  side: Side;
  gameDurationSec: number | null;
  participants: ParticipantInput[];
  pickBans: PickBanInput[];
};

const LANE_BY_INDEX = ["TOP", "JG", "MID", "ADC", "SUPP"] as const;

export function formatRoleLabel(role: LoLRole | null, laneIndex: number): string {
  if (role === "TOP") return "TOP";
  if (role === "JUNGLE") return "JG";
  if (role === "MID") return "MID";
  if (role === "ADC") return "ADC";
  if (role === "SUPPORT") return "SUPP";
  if (role === "FILL") return LANE_BY_INDEX[laneIndex] ?? "FILL";
  return LANE_BY_INDEX[laneIndex] ?? "—";
}

export function kdaString(row: ScoreboardRow): string {
  if (row.kills == null || row.deaths == null || row.assists == null) {
    return "—";
  }
  return `${row.kills}/${row.deaths}/${row.assists}`;
}

export function formatCs(value: number | null): string {
  if (value == null) return "—";
  return String(value);
}

export function formatDamage(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1000) {
    const asK = value / 1000;
    const text = Number.isInteger(asK) ? String(asK) : asK.toFixed(1);
    return `${text}k`;
  }
  return String(value);
}

export function formatGameDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type TeamTotals = {
  kills: number;
  damage: number;
  cs: number;
};

export function teamTotals(rows: ScoreboardRow[]): TeamTotals {
  return rows.reduce(
    (acc, r) => ({
      kills: acc.kills + (r.kills ?? 0),
      damage: acc.damage + (r.damage ?? 0),
      cs: acc.cs + (r.cs ?? 0),
    }),
    { kills: 0, damage: 0, cs: 0 },
  );
}

export const SCOREBOARD_LANES = ["TOP", "JG", "MID", "ADC", "SUPP"] as const;

export type MirroredLaneRow = {
  lane: (typeof SCOREBOARD_LANES)[number];
  blue: ScoreboardRow | null;
  red: ScoreboardRow | null;
};

export function mirroredLaneRows(
  blue: TeamScoreboard,
  red: TeamScoreboard,
): MirroredLaneRow[] {
  return SCOREBOARD_LANES.map((lane) => ({
    lane,
    blue: blue.rows.find((r) => r.role === lane) ?? null,
    red: red.rows.find((r) => r.role === lane) ?? null,
  }));
}

function picksForSide(pickBans: PickBanInput[], side: Side): string[] {
  return pickBans
    .filter((p) => p.type === "PICK" && p.side === side)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.champion);
}

function rowsFromSidePicks(
  side: Side,
  pickBans: PickBanInput[],
  opponent: string | null,
): ScoreboardRow[] {
  return picksForSide(pickBans, side).map((champion, i) =>
    pickRow(champion, opponent, i),
  );
}

function participantRow(
  p: ParticipantInput,
  isOurTeam: boolean,
  laneIndex: number,
): ScoreboardRow {
  const scoreboardRole = laneRoleFromPart(p, laneIndex);
  const build = normalizeParticipantBuild(parseBuildJson(p.buildJson), {
    position: p.position,
    teamRole: p.player.teamRole,
    laneIndex,
    scoreboardRole,
  });
  return {
    champion: p.champion,
    summonerName:
      p.player.summonerName?.split("#")[0] ?? p.player.displayName,
    role: scoreboardRole,
    position: p.position,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    cs: p.cs,
    damage: p.damage,
    goldEarned: p.goldEarned,
    visionScore: p.visionScore,
    itemIds: build?.itemIds ?? [],
    questItemId: build?.questItemId ?? null,
    trinketItemId: build?.trinketItemId ?? null,
    spell1Id: build?.spell1Id ?? null,
    spell2Id: build?.spell2Id ?? null,
    perks: build?.perks ?? null,
    isOurTeam,
  };
}

function pickRow(
  champion: string,
  opponent: string | null,
  laneIndex: number,
): ScoreboardRow {
  const lane = LANE_BY_INDEX[laneIndex] ?? "—";
  return {
    champion,
    summonerName: opponent ? `${opponent} · ${lane}` : lane,
    role: lane,
    position: null,
    kills: null,
    deaths: null,
    assists: null,
    cs: null,
    damage: null,
    goldEarned: null,
    visionScore: null,
    itemIds: [],
    spell1Id: null,
    spell2Id: null,
    perks: null,
    isOurTeam: false,
  };
}

function enemyRowsFromPicks(
  enemySide: Side,
  pickBans: PickBanInput[],
  ourChampions: Set<string>,
  opponent: string | null,
): ScoreboardRow[] {
  const pickOrder = picksForSide(pickBans, enemySide);
  const champs =
    pickOrder.length > 0
      ? pickOrder
      : enemyPickChampions(pickBans, ourChampions);
  return champs.map((c, i) => pickRow(c, opponent, i));
}

function orderByPicks(rows: ScoreboardRow[], pickOrder: string[]): ScoreboardRow[] {
  if (pickOrder.length === 0) return rows;
  const order = new Map(pickOrder.map((c, i) => [c, i]));
  return [...rows].sort(
    (a, b) => (order.get(a.champion) ?? 99) - (order.get(b.champion) ?? 99),
  );
}

function teamWon(
  side: Side,
  ourSide: Side,
  result: MatchResult | null,
): boolean | null {
  if (!result) return null;
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

const POSITION_ORDER = ["TOP", "JUNGLE", "MIDDLE", "MID", "BOTTOM", "ADC", "UTILITY", "SUPPORT"];

function positionSortIndex(position: string | null, teamRole: LoLRole): number {
  const p = (position ?? "").toUpperCase();
  const i = POSITION_ORDER.indexOf(p);
  if (i !== -1) return i;
  const roleMap: Record<string, number> = {
    TOP: 0,
    JUNGLE: 1,
    MID: 2,
    ADC: 4,
    SUPPORT: 6,
    FILL: 7,
  };
  return roleMap[teamRole] ?? 99;
}

function sortPartsByLane(parts: ParticipantInput[]): ParticipantInput[] {
  return [...parts].sort(
    (a, b) =>
      positionSortIndex(a.position, a.player.teamRole) -
      positionSortIndex(b.position, b.player.teamRole),
  );
}

function laneRoleFromPart(part: ParticipantInput, laneIndex: number): string {
  const p = (part.position ?? "").toUpperCase();
  if (p === "TOP") return "TOP";
  if (p === "JUNGLE") return "JG";
  if (p === "MIDDLE" || p === "MID") return "MID";
  if (p === "BOTTOM" || p === "ADC") return "ADC";
  if (p === "UTILITY" || p === "SUPPORT") return "SUPP";
  // Use sorted lane index, not roster teamRole (often wrong for off-role games).
  return LANE_BY_INDEX[laneIndex] ?? "—";
}

function withLaneIndex(
  parts: ParticipantInput[],
  _pickOrder: string[],
  isOurTeam: boolean,
): ScoreboardRow[] {
  const sorted = sortPartsByLane(parts);
  return sorted.map((part, i) => participantRow(part, isOurTeam, i));
}

export function buildMatchScoreboard(match: MatchInput): MatchScoreboardData {
  const ourSide = match.side;
  const enemySide: Side = ourSide === "BLUE" ? "RED" : "BLUE";
  const bluePickOrder = picksForSide(match.pickBans, "BLUE");
  const redPickOrder = picksForSide(match.pickBans, "RED");
  const ourChampions = new Set(match.participants.map((p) => p.champion));

  const blueParts = match.participants.filter((p) => p.side === "BLUE");
  const redParts = match.participants.filter((p) => p.side === "RED");
  const ourParts = match.participants.filter(
    (p) => !p.side || p.side === ourSide,
  );
  const enemyParts = match.participants.filter((p) => p.side === enemySide);

  let blueRows: ScoreboardRow[];
  let redRows: ScoreboardRow[];

  if (blueParts.length >= 5 && redParts.length >= 5) {
    blueRows = withLaneIndex(blueParts, bluePickOrder, ourSide === "BLUE");
    redRows = withLaneIndex(redParts, redPickOrder, ourSide === "RED");
  } else if (ourSide === "BLUE") {
    blueRows = withLaneIndex(ourParts, bluePickOrder, true);
    redRows =
      enemyParts.length > 0
        ? withLaneIndex(enemyParts, redPickOrder, false)
        : orderByPicks(
            enemyRowsFromPicks(
              "RED",
              match.pickBans,
              ourChampions,
              match.opponent,
            ),
            redPickOrder,
          );
  } else {
    redRows = withLaneIndex(ourParts, redPickOrder, true);
    blueRows =
      enemyParts.length > 0
        ? withLaneIndex(enemyParts, bluePickOrder, false)
        : orderByPicks(
            enemyRowsFromPicks(
              "BLUE",
              match.pickBans,
              ourChampions,
              match.opponent,
            ),
            bluePickOrder,
          );
  }

  // Some imports can contain participants only for one team; fall back to draft picks.
  if (blueRows.length === 0) {
    blueRows = rowsFromSidePicks("BLUE", match.pickBans, match.opponent);
  }
  if (redRows.length === 0) {
    redRows = rowsFromSidePicks("RED", match.pickBans, match.opponent);
  }

  return {
    matchId: match.id,
    playedAt: match.playedAt.toISOString(),
    league: match.league,
    opponent: match.opponent,
    result: match.result,
    ourSide,
    gameDurationSec: match.gameDurationSec,
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
