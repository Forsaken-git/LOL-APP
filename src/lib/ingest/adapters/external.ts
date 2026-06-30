import type {
  EventType,
  GameType,
  MatchResult,
  Side,
} from "@prisma/client";
import { normalizeGameType } from "@/lib/ingest/normalize-game-type";
import type {
  IngestEvent,
  IngestMatch,
  IngestParticipant,
  IngestPayload,
  IngestPickBan,
  IngestPlayer,
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return undefined;
}

function normalizeResult(value: unknown): MatchResult | null {
  if (value === true || value === "true" || value === 1 || value === "1") return "WIN";
  if (value === false || value === "false" || value === 0 || value === "0") return "LOSS";
  if (typeof value !== "string") return null;
  const u = value.toUpperCase();
  if (u === "WIN" || u === "W" || u === "VICTORY") return "WIN";
  if (u === "LOSS" || u === "L" || u === "LOSE" || u === "DEFEAT") return "LOSS";
  return null;
}

function normalizeSide(value: unknown): Side | null {
  if (typeof value !== "string") return null;
  const u = value.toUpperCase();
  if (u === "BLUE" || u === "B" || u === "100") return "BLUE";
  if (u === "RED" || u === "R" || u === "200") return "RED";
  return null;
}

function normalizeEventType(value: unknown, title?: string): EventType {
  const text = `${typeof value === "string" ? value : ""} ${title ?? ""}`.toLowerCase();
  if (text.includes("prime")) return "OTHER";
  if (text.includes("scrim") || text.includes("practice")) return "SCRIM";
  if (text.includes("train")) return "TRAINING";
  if (text.includes("meet")) return "MEETING";
  if (text.includes("match") || text.includes("official")) return "MATCH";
  return "OTHER";
}

function toIsoDate(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function findArray(
  root: Record<string, unknown>,
  names: string[],
): unknown[] | null {
  for (const name of names) {
    const direct = root[name];
    if (Array.isArray(direct) && direct.length > 0) return direct;
  }
  for (const value of Object.values(root)) {
    if (!isRecord(value)) continue;
    for (const name of names) {
      const nested = value[name];
      if (Array.isArray(nested) && nested.length > 0) return nested;
    }
  }
  return null;
}

function mapParticipant(raw: Record<string, unknown>): IngestParticipant | null {
  const champion = pickString(raw, "champion", "championName", "champ", "character");
  if (!champion) return null;

  return {
    playerExternalId: pickString(raw, "playerExternalId", "player_external_id", "playerId", "id"),
    displayName: pickString(raw, "displayName", "display_name", "name", "summoner"),
    summonerName: pickString(raw, "summonerName", "summoner_name", "riotId", "riot_id"),
    champion,
    kills: pickNumber(raw, "kills", "k"),
    deaths: pickNumber(raw, "deaths", "d"),
    assists: pickNumber(raw, "assists", "a"),
    cs: pickNumber(raw, "cs", "creepScore", "creep_score", "minions", "totalMinionsKilled"),
    damage: pickNumber(raw, "damage", "dmg", "totalDamageDealtToChampions", "damageDealt"),
  };
}

function mapPickBan(raw: Record<string, unknown>, order: number): IngestPickBan | null {
  const champion = pickString(raw, "champion", "championName", "champ");
  const typeRaw = pickString(raw, "type", "action")?.toUpperCase();
  const side = normalizeSide(raw.side ?? raw.team);
  if (!champion || !typeRaw || !side) return null;
  const type = typeRaw === "BAN" || typeRaw === "B" ? "BAN" : "PICK";
  return { champion, type, side, order: pickNumber(raw, "order") ?? order };
}

function mapMatch(raw: Record<string, unknown>): IngestMatch | null {
  const playedAt = toIsoDate(
    raw.playedAt ?? raw.played_at ?? raw.date ?? raw.gameDate ?? raw.startTime ?? raw.timestamp,
  );
  const result = normalizeResult(raw.result ?? raw.outcome ?? raw.win);
  const side = normalizeSide(raw.side ?? raw.teamSide ?? raw.team_side);
  const league =
    pickString(raw, "league", "competition", "tournament", "series", "bracket") ?? "Imported";

  if (!playedAt || !result || !side) return null;

  const participantsRaw =
    (raw.participants as unknown) ??
    raw.players ??
    raw.roster ??
    raw.lineup ??
    raw.team;
  let participants: IngestParticipant[] | undefined;
  if (Array.isArray(participantsRaw)) {
    participants = participantsRaw
      .filter(isRecord)
      .map(mapParticipant)
      .filter((p): p is IngestParticipant => p != null);
  }

  const pickBansRaw = raw.pickBans ?? raw.pick_bans ?? raw.draft ?? raw.bans;
  let pickBans: IngestPickBan[] | undefined;
  if (Array.isArray(pickBansRaw)) {
    pickBans = pickBansRaw
      .filter(isRecord)
      .map((pb, i) => mapPickBan(pb, i))
      .filter((p): p is IngestPickBan => p != null);
  }

  return {
    externalId: pickString(raw, "externalId", "external_id", "matchId", "match_id", "gameId", "id"),
    playedAt,
    league,
    opponent: pickString(raw, "opponent", "enemy", "enemyTeam", "enemy_team", "vs", "versus"),
    result,
    side,
    gameType: normalizeGameType(raw.gameType ?? raw.game_type ?? raw.matchType, league),
    notes: pickString(raw, "notes", "note", "comment"),
    source: pickString(raw, "source"),
    mvpExternalId: pickString(raw, "mvpExternalId", "mvp_external_id", "mvpId"),
    mvpDisplayName: pickString(raw, "mvpDisplayName", "mvp", "mvp_name"),
    participants: participants?.length ? participants : undefined,
    pickBans: pickBans?.length ? pickBans : undefined,
  };
}

function mapPlayer(raw: Record<string, unknown>): IngestPlayer | null {
  const displayName = pickString(raw, "displayName", "display_name", "name", "nickname");
  if (!displayName) return null;
  const teamRole = pickString(raw, "teamRole", "team_role", "role", "position")?.toUpperCase();
  return {
    externalId: pickString(raw, "externalId", "external_id", "id", "playerId"),
    displayName,
    summonerName: pickString(raw, "summonerName", "summoner_name", "riotId", "riot_id"),
    teamRole:
      teamRole === "TOP" ||
      teamRole === "JUNGLE" ||
      teamRole === "MID" ||
      teamRole === "ADC" ||
      teamRole === "SUPPORT" ||
      teamRole === "FILL"
        ? teamRole
        : undefined,
  };
}

function mapEvent(raw: Record<string, unknown>): IngestEvent | null {
  const title = pickString(raw, "title", "name", "summary", "label");
  const startAt = toIsoDate(
    raw.startAt ?? raw.start_at ?? raw.date ?? raw.start ?? raw.startTime,
  );
  if (!title || !startAt) return null;

  const endAt = toIsoDate(raw.endAt ?? raw.end_at ?? raw.end ?? raw.endTime);

  return {
    externalId: pickString(raw, "externalId", "external_id", "id"),
    title,
    type: normalizeEventType(raw.type ?? raw.category ?? raw.kind, title),
    startAt,
    endAt: endAt ?? undefined,
    description: pickString(raw, "description", "notes", "note"),
    location: pickString(raw, "location", "place"),
  };
}

/** True if JSON already matches Renim A. export shape. */
export function isHubPayload(raw: Record<string, unknown>): boolean {
  const matches = raw.matches;
  if (!Array.isArray(matches) || matches.length === 0) return Boolean(raw.players ?? raw.events);
  const first = matches[0];
  return isRecord(first) && typeof first.playedAt === "string" && isMatchShapeResult(first.result);
}

function isMatchShapeResult(value: unknown): boolean {
  return value === "WIN" || value === "LOSS";
}

export function hubPayloadFrom(raw: Record<string, unknown>): IngestPayload {
  return {
    source: typeof raw.source === "string" ? raw.source : undefined,
    players: Array.isArray(raw.players) ? (raw.players as IngestPlayer[]) : [],
    matches: Array.isArray(raw.matches) ? (raw.matches as IngestMatch[]) : [],
    events: Array.isArray(raw.events) ? (raw.events as IngestEvent[]) : [],
  };
}

/**
 * Map JSON from spreadsheets, other trackers, or custom exports into Renim A. ingest format.
 */
export function adaptExternalPayload(raw: Record<string, unknown>): IngestPayload {
  const source =
    pickString(raw, "source", "tool", "exportedFrom", "app") ?? "external-import";

  const players = (findArray(raw, ["players", "roster", "team", "members"]) ?? [])
    .filter(isRecord)
    .map(mapPlayer)
    .filter((p): p is IngestPlayer => p != null);

  const matches = (findArray(raw, ["matches", "games", "gamesPlayed", "results", "history"]) ?? [])
    .filter(isRecord)
    .map(mapMatch)
    .filter((m): m is IngestMatch => m != null);

  const events = (
    findArray(raw, ["events", "schedule", "calendar", "fixtures", "appointments"]) ?? []
  )
    .filter(isRecord)
    .map(mapEvent)
    .filter((e): e is IngestEvent => e != null);

  return {
    source,
    players,
    matches,
    events,
  };
}
