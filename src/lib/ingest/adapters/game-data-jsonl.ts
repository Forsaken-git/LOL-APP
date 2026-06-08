import { createReadStream } from "fs";
import { basename } from "path";
import { createInterface } from "readline";
import type { Side } from "@prisma/client";
import { teamRosterEntries } from "@/lib/team-roster";
import {
  extractParticipantFromEogPlayer,
  type EogPlayerRaw,
  type EogStatsRaw,
  type EogTeamRaw,
} from "../eog-player";
import type {
  IngestMatch,
  IngestPayload,
  IngestPickBan,
} from "../types";

type JsonlLine = {
  timestamp_utc?: string;
  sources?: {
    lcu_eog_stats?: EogStatsRaw;
    lcu_champ_select?: unknown;
  };
};

function sideForTeamId(teamId: number, blueId: number): Side {
  return teamId === blueId ? "BLUE" : "RED";
}

function opponentLabel(enemyPlayers: EogPlayerRaw[]): string {
  const names = enemyPlayers
    .map((p) => p.riotIdGameName ?? p.summonerName?.split("#")[0])
    .filter(Boolean)
    .slice(0, 2) as string[];
  if (names.length === 0) return "Opponent";
  return names.join(" & ");
}

function normalizedName(value: string | undefined): string | null {
  if (!value) return null;
  const base = value.split("#")[0]?.trim().toLowerCase();
  if (!base) return null;
  return base;
}

function rosterNameSet(): Set<string> {
  const set = new Set<string>();
  for (const p of teamRosterEntries()) {
    const a = normalizedName(p.displayName);
    const b = normalizedName(p.summonerName);
    if (a) set.add(a);
    if (b) set.add(b);
  }
  return set;
}

function teamRosterScore(team: EogTeamRaw, roster: Set<string>): number {
  return (team.players ?? []).reduce((acc, p) => {
    const game = normalizedName(p.riotIdGameName);
    const sum = normalizedName(p.summonerName);
    if (game && roster.has(game)) return acc + 2;
    if (sum && roster.has(sum)) return acc + 1;
    return acc;
  }, 0);
}

function pickOurAndEnemyTeams(teams: EogTeamRaw[]): {
  ourTeam: EogTeamRaw;
  enemyTeam: EogTeamRaw;
} | null {
  if (teams.length < 2) return null;

  const roster = rosterNameSet();
  const scored = teams.map((team) => ({
    team,
    score: teamRosterScore(team, roster),
  }));
  scored.sort((a, b) => b.score - a.score);

  if (scored[0].score > 0) {
    return { ourTeam: scored[0].team, enemyTeam: scored[1].team };
  }

  const flaggedOur = teams.find((t) => t.isPlayerTeam);
  const flaggedEnemy = teams.find((t) => !t.isPlayerTeam);
  if (flaggedOur && flaggedEnemy) {
    return { ourTeam: flaggedOur, enemyTeam: flaggedEnemy };
  }

  return { ourTeam: teams[0], enemyTeam: teams[1] };
}

const POSITION_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

function positionIndex(pos: string | undefined): number {
  const p = (pos ?? "").toUpperCase();
  const i = POSITION_ORDER.indexOf(p);
  return i === -1 ? 99 : i;
}

function pickBansFromEog(
  ourTeam: EogTeamRaw,
  enemyTeam: EogTeamRaw,
  ourSide: Side,
): IngestPickBan[] {
  const enemySide: Side = ourSide === "BLUE" ? "RED" : "BLUE";
  const ourPicks = [...(ourTeam.players ?? [])].sort(
    (a, b) =>
      positionIndex(a.detectedTeamPosition) -
      positionIndex(b.detectedTeamPosition),
  );
  const enemyPicks = [...(enemyTeam.players ?? [])].sort(
    (a, b) =>
      positionIndex(a.detectedTeamPosition) -
      positionIndex(b.detectedTeamPosition),
  );

  const out: IngestPickBan[] = [];
  let order = 0;
  for (let i = 0; i < 5; i++) {
    if (enemyPicks[i]?.championName) {
      out.push({
        champion: enemyPicks[i].championName!,
        type: "PICK",
        side: enemySide,
        order: order++,
      });
    }
    if (ourPicks[i]?.championName) {
      out.push({
        champion: ourPicks[i].championName!,
        type: "PICK",
        side: ourSide,
        order: order++,
      });
    }
  }
  return out;
}

export function ingestMatchFromEog(
  eog: EogStatsRaw,
  playedAt: string,
  source: string,
  league: string,
): IngestMatch | null {
  if (!eog.teams?.length) return null;
  const picked = pickOurAndEnemyTeams(eog.teams);
  if (!picked) return null;
  const { ourTeam, enemyTeam } = picked;

  const blueId = Math.min(ourTeam.teamId, enemyTeam.teamId);
  const ourSide = sideForTeamId(ourTeam.teamId, blueId);
  const enemySide: Side = ourSide === "BLUE" ? "RED" : "BLUE";
  const result = ourTeam.isWinningTeam ? "WIN" : "LOSS";

  const participants = [
    ...(ourTeam.players ?? []).map((p) =>
      extractParticipantFromEogPlayer(p, ourSide, false),
    ),
    ...(enemyTeam.players ?? []).map((p) =>
      extractParticipantFromEogPlayer(p, enemySide, true),
    ),
  ];

  return {
    externalId: `jsonl-${eog.gameId}`,
    playedAt,
    league,
    opponent: opponentLabel(enemyTeam.players ?? []),
    result,
    side: ourSide,
    gameType: "SCRIM",
    gameDurationSec: eog.gameLength,
    source,
    participants,
    pickBans: pickBansFromEog(ourTeam, enemyTeam, ourSide),
  };
}

/** Read JSONL and use the last snapshot that includes `lcu_eog_stats`. */
export async function parseGameDataJsonlFile(
  filePath: string,
  options?: { league?: string; source?: string },
): Promise<IngestPayload> {
  const league = options?.league ?? "Scrims";
  const source =
    options?.source ?? `import-${basename(filePath, ".jsonl")}`;

  let lastEog: { eog: EogStatsRaw; playedAt: string } | null = null;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: JsonlLine;
    try {
      row = JSON.parse(trimmed) as JsonlLine;
    } catch {
      continue;
    }
    const eog = row.sources?.lcu_eog_stats;
    if (!eog?.teams?.length) continue;
    lastEog = {
      eog,
      playedAt: row.timestamp_utc ?? new Date().toISOString(),
    };
  }

  if (!lastEog) {
    throw new Error(
      `No end-of-game data in ${basename(filePath)}. Need a line with sources.lcu_eog_stats.`,
    );
  }

  const match = ingestMatchFromEog(
    lastEog.eog,
    lastEog.playedAt,
    source,
    league,
  );
  if (!match) {
    throw new Error("Could not build match from end-of-game stats.");
  }

  const players = teamRosterEntries().map((p) => ({
    displayName: p.displayName,
    summonerName: p.summonerName,
    teamRole: p.teamRole,
    memberRole: p.memberRole,
  }));

  return {
    source,
    players,
    matches: [match],
    events: [],
  };
}

export function isGameDataJsonlPath(path: string): boolean {
  return path.toLowerCase().endsWith(".jsonl");
}
