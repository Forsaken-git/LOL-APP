import type {
  GameType,
  MatchResult,
  Side,
} from "@prisma/client";
import {
  finalizeParticipantBuild,
  laneIndexFromPosition,
  scoreboardRoleForLaneIndex,
} from "@/lib/build-normalize";
import { CHAMPIONS } from "@/lib/champions";
import { parseLocalDateTime } from "@/lib/datetime";
import type { ParticipantBuild } from "@/lib/ingest/types";

const RESULTS = new Set<string>(["WIN", "LOSS"]);
const SIDES = new Set<string>(["BLUE", "RED"]);
const GAME_TYPES = new Set<string>(["OFFICIAL", "SCRIM", "TRAINING"]);

const CHAMPION_SET = new Set<string>(CHAMPIONS);

function normalizeChampion(name: string): string | null {
  if (CHAMPION_SET.has(name)) return name;
  return (
    CHAMPIONS.find((c) => c.toLowerCase() === name.toLowerCase()) ?? null
  );
}

export type ParsedParticipantRow = {
  playerId?: string;
  label?: string;
  champion: string;
  position: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  cs: number | null;
  damage: number | null;
  goldEarned: number | null;
  visionScore: number | null;
  build: ParticipantBuild | null;
};

export type ParsedManualMatchBody = {
  playedAt: Date;
  gameDurationSec: number | null;
  league: string;
  opponent: string;
  result: MatchResult;
  side: Side;
  gameType: GameType;
  notes: string | null;
  ourParticipants: ParsedParticipantRow[];
  enemyParticipants: ParsedParticipantRow[];
};

function parseOptionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (!raw) return null;
    const compact = raw.replace(/[,\s_]+/g, "");
    if (!compact) return null;
    if (compact.endsWith("k")) {
      const base = Number.parseFloat(compact.slice(0, -1));
      if (!Number.isFinite(base) || base < 0) return null;
      return Math.floor(base * 1000);
    }
    const n = Number.parseFloat(compact);
    if (Number.isNaN(n) || n < 0) return null;
    return Math.floor(n);
  }
  return null;
}

function parseItemIds(value: unknown): number[] {
  if (value == null || value === "") return [];
  const raw =
    typeof value === "string"
      ? value.split(/[,;\s]+/)
      : Array.isArray(value)
        ? value.map(String)
        : [];
  return raw
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function parseBuild(value: unknown): ParticipantBuild | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const itemIds = parseItemIds(o.itemIds);
  const spell1Id = parseOptionalInt(o.spell1Id) ?? undefined;
  const spell2Id = parseOptionalInt(o.spell2Id) ?? undefined;
  const perksRaw = o.perks;
  let perks: ParticipantBuild["perks"] | undefined;
  if (perksRaw && typeof perksRaw === "object") {
    const p = perksRaw as Record<string, unknown>;
    const slots = Array.isArray(p.slots)
      ? p.slots
          .map((v) => parseOptionalInt(v))
          .filter((n): n is number => n != null)
      : [];
    const primaryStyle = parseOptionalInt(p.primaryStyle) ?? undefined;
    const subStyle = parseOptionalInt(p.subStyle) ?? undefined;
    if (slots.length > 0 || primaryStyle != null || subStyle != null) {
      perks = { slots, primaryStyle, subStyle };
    }
  }
  if (itemIds.length === 0 && spell1Id == null && spell2Id == null && !perks) return null;
  const questItemId = parseOptionalInt(o.questItemId) ?? undefined;
  const trinketItemId = parseOptionalInt(o.trinketItemId) ?? undefined;
  return {
    itemIds,
    spell1Id,
    spell2Id,
    perks,
    ...(questItemId != null ? { questItemId } : {}),
    ...(trinketItemId != null ? { trinketItemId } : {}),
  };
}

function parseGameDurationSec(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(raw);
  if (!m) return null;
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}

function parseParticipantRow(
  raw: unknown,
  mode: "our" | "enemy",
): ParsedParticipantRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const championRaw =
    typeof o.champion === "string" ? o.champion.trim() : "";
  if (!championRaw) return null;

  const champion = normalizeChampion(championRaw);
  if (!champion) return null;

  const playerId =
    typeof o.playerId === "string" && o.playerId.trim()
      ? o.playerId.trim()
      : undefined;
  const label =
    typeof o.label === "string" && o.label.trim()
      ? o.label.trim()
      : undefined;

  if (mode === "our" && !playerId) return null;

  const position =
    typeof o.position === "string" && o.position.trim()
      ? o.position.trim().toUpperCase()
      : null;

  return {
    playerId,
    label: label ?? (mode === "enemy" ? champion : undefined),
    champion,
    position,
    kills: parseOptionalInt(o.kills),
    deaths: parseOptionalInt(o.deaths),
    assists: parseOptionalInt(o.assists),
    cs: parseOptionalInt(o.cs),
    damage: parseOptionalInt(o.damage),
    goldEarned: parseOptionalInt(o.goldEarned),
    visionScore: parseOptionalInt(o.visionScore),
    build: (() => {
      const parsed = parseBuild(o.build ?? o);
      if (!parsed) return null;
      const laneIndex = laneIndexFromPosition(position);
      return finalizeParticipantBuild(parsed, {
        position,
        laneIndex,
        scoreboardRole: scoreboardRoleForLaneIndex(laneIndex),
      });
    })(),
  };
}

export function parseManualMatchBody(
  body: Record<string, unknown>,
):
  | { ok: true; data: ParsedManualMatchBody }
  | { ok: false; error: string } {
  const date = body.date;
  const time = body.time;
  const playedAtRaw = body.playedAt;

  let playedAt: Date;
  if (typeof playedAtRaw === "string" && playedAtRaw) {
    playedAt = new Date(playedAtRaw);
  } else if (typeof date === "string" && typeof time === "string") {
    playedAt = parseLocalDateTime(date, time);
  } else {
    return { ok: false, error: "Date and time are required" };
  }

  if (Number.isNaN(playedAt.getTime())) {
    return { ok: false, error: "Invalid date or time" };
  }

  const league =
    typeof body.league === "string" ? body.league.trim() : "";
  const opponent =
    typeof body.opponent === "string" ? body.opponent.trim() : "";
  const result = body.result;
  const side = body.side;
  const gameType = body.gameType;
  const gameDurationSec = parseGameDurationSec(body.gameDuration ?? body.gameDurationSec);

  if (!league) return { ok: false, error: "League is required" };
  if (!opponent) return { ok: false, error: "Opponent is required" };
  if (!result || typeof result !== "string" || !RESULTS.has(result)) {
    return { ok: false, error: "Result must be WIN or LOSS" };
  }
  if (!side || typeof side !== "string" || !SIDES.has(side)) {
    return { ok: false, error: "Side must be BLUE or RED" };
  }

  const parsedGameType =
    typeof gameType === "string" && GAME_TYPES.has(gameType)
      ? (gameType as GameType)
      : "OFFICIAL";

  const ourRaw = Array.isArray(body.ourParticipants)
    ? body.ourParticipants
    : [];
  const enemyRaw = Array.isArray(body.enemyParticipants)
    ? body.enemyParticipants
    : [];

  const ourParticipants = ourRaw
    .map((row) => parseParticipantRow(row, "our"))
    .filter((r): r is ParsedParticipantRow => r != null);

  if (ourParticipants.length === 0) {
    return {
      ok: false,
      error: "Add at least one roster player with a champion",
    };
  }

  const enemyParticipants = enemyRaw
    .map((row) => parseParticipantRow(row, "enemy"))
    .filter((r): r is ParsedParticipantRow => r != null);

  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;

  return {
    ok: true,
    data: {
      playedAt,
      gameDurationSec,
      league,
      opponent,
      result: result as MatchResult,
      side: side as Side,
      gameType: parsedGameType,
      notes,
      ourParticipants,
      enemyParticipants,
    },
  };
}
