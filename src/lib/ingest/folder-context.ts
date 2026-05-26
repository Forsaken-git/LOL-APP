import type { EventType, GameType } from "@prisma/client";
import {
  IMPORT_FOLDER_NAMES,
  inferCompetitionFromPath,
  type CompetitionId,
} from "../competitions";
import type { IngestMatch, IngestPayload } from "./types";

export type ImportFolderKind = CompetitionId | null;

export type ImportFolderContext = {
  kind: NonNullable<ImportFolderKind>;
  league: string;
  gameType: GameType;
  eventType: EventType;
  sourceLabel: string;
};

export const TEAM_DATA_FOLDERS = IMPORT_FOLDER_NAMES;

export function inferFolderContext(filePath: string): ImportFolderContext | null {
  const competition = inferCompetitionFromPath(filePath);
  if (!competition) return null;

  return {
    kind: competition.id,
    league: competition.league,
    gameType: competition.gameType,
    eventType: competition.eventType,
    sourceLabel: competition.id,
  };
}

export function applyFolderContext(
  payload: IngestPayload,
  ctx: ImportFolderContext | null,
): IngestPayload {
  if (!ctx) return payload;

  const matches = (payload.matches ?? []).map((m) => applyMatchContext(m, ctx));
  const events = (payload.events ?? []).map((e) => {
    const type =
      e.type && e.type !== "OTHER" && e.type !== "MATCH"
        ? e.type
        : (ctx.eventType ?? e.type);
    return {
      ...e,
      type,
      externalId:
        e.externalId ??
        `${ctx.kind}-${e.startAt}-${e.title}`.replace(/\s+/g, "-").slice(0, 120),
    };
  });

  return {
    ...payload,
    source: payload.source ?? `import-${ctx.sourceLabel}`,
    matches,
    events,
  };
}

function applyMatchContext(match: IngestMatch, ctx: ImportFolderContext): IngestMatch {
  const league =
    !match.league || match.league === "Imported" ? ctx.league : match.league;

  return {
    ...match,
    league,
    gameType: match.gameType ?? ctx.gameType,
    externalId:
      match.externalId ??
      `${ctx.kind}-${match.playedAt}-${match.opponent ?? "game"}`
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 120),
    source: match.source ?? `import-${ctx.sourceLabel}`,
  };
}

export function teamDataRoot(parent = "data/import"): string {
  return parent;
}
