import {
  adaptExternalPayload,
  hubPayloadFrom,
  isHubPayload,
} from "./adapters/external";
import {
  applyFolderContext,
  type ImportFolderContext,
} from "./folder-context";
import type {
  IngestEvent,
  IngestMatch,
  IngestPayload,
  IngestPlayer,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMatchShape(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.playedAt === "string" &&
    (obj.result === "WIN" || obj.result === "LOSS") &&
    !Array.isArray(obj.matches)
  );
}

export type NormalizeOptions = {
  folderContext?: ImportFolderContext | null;
};

/** Accepts hub export, LCU per-game export, or an array of either. */
export function normalizeIngestPayload(
  raw: unknown,
  options?: NormalizeOptions,
): IngestPayload {
  if (Array.isArray(raw)) {
    return mergeIngestPayloads(
      raw.map((item) => normalizeIngestPayload(item, options)),
    );
  }

  if (!isRecord(raw)) {
    throw new Error("Invalid JSON: expected an object or array of objects");
  }

  let payload: IngestPayload;

  if (isMatchShape(raw)) {
    payload = {
      matches: [raw as unknown as IngestMatch],
      players: [],
      events: [],
    };
  } else if (isHubPayload(raw)) {
    payload = hubPayloadFrom(raw);
  } else {
    const adapted = adaptExternalPayload(raw);
    if (
      (adapted.players?.length ?? 0) > 0 ||
      (adapted.matches?.length ?? 0) > 0 ||
      (adapted.events?.length ?? 0) > 0
    ) {
      payload = adapted;
    } else {
      throw new Error(
        "Could not map this JSON to Renim A. format. Run: npm run ingest:inspect -- your-file.json",
      );
    }
  }

  return applyFolderContext(payload, options?.folderContext ?? null);
}

export function mergeIngestPayloads(payloads: IngestPayload[]): IngestPayload {
  const playersMap = new Map<string, IngestPlayer>();
  const matchesMap = new Map<string, IngestMatch>();
  const eventsMap = new Map<string, IngestEvent>();
  const sources = new Set<string>();

  for (const payload of payloads) {
    if (payload.source) sources.add(payload.source);

    for (const player of payload.players ?? []) {
      const key =
        player.externalId ??
        player.summonerName ??
        player.displayName ??
        `_anon_${playersMap.size}`;
      playersMap.set(key, player);
    }

    for (const match of payload.matches ?? []) {
      const key =
        match.externalId ??
        `${match.playedAt}|${match.opponent ?? ""}|${match.league ?? ""}`;
      matchesMap.set(key, match);
    }

    for (const event of payload.events ?? []) {
      const key = event.externalId ?? `${event.startAt}|${event.title}`;
      eventsMap.set(key, event);
    }
  }

  return {
    source: sources.size === 1 ? [...sources][0] : sources.size > 1 ? "bulk-import" : undefined,
    players: [...playersMap.values()],
    matches: [...matchesMap.values()],
    events: [...eventsMap.values()],
  };
}
