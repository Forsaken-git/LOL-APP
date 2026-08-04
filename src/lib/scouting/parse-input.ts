import {
  REGION_META,
  type PlayerRegion,
} from "@/lib/player-accounts-shared";
import { parseRiotId } from "@/lib/riot/client";

export const SCOUTING_MAX_PLAYERS = 5;

export type ScoutingParseResult = {
  region: PlayerRegion;
  riotIds: string[];
  /** Extra IDs beyond the 5-player cap (informational). */
  truncated: number;
  /** How region was determined. */
  regionSource: "url" | "fallback";
  warnings: string[];
};

const SLUG_TO_REGION: Record<string, PlayerRegion> = {
  euw: "WEST",
  eune: "EAST",
};

function normalizeRiotId(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  // OP.GG sometimes uses Name-TAG in paths; multisearch uses Name#TAG.
  const withHash = trimmed.includes("#")
    ? trimmed
    : trimmed.includes("-")
      ? (() => {
          const i = trimmed.lastIndexOf("-");
          return `${trimmed.slice(0, i)}#${trimmed.slice(i + 1)}`;
        })()
      : trimmed;
  const parsed = parseRiotId(withHash);
  if (!parsed) return null;
  return `${parsed.gameName}#${parsed.tagLine}`;
}

function dedupeRiotIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

function splitRiotIdList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOpGgMultisearch(
  text: string,
): { region: PlayerRegion; riotIds: string[] } | null {
  const trimmed = text.trim();
  if (!/op\.gg/i.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const path = url.pathname.toLowerCase();
  if (!path.includes("multisearch") && !url.searchParams.has("summoners")) {
    return null;
  }

  let region: PlayerRegion | null = null;
  const slugMatch = path.match(/\/(?:lol\/)?multisearch\/([a-z0-9]+)/i);
  if (slugMatch?.[1] && SLUG_TO_REGION[slugMatch[1].toLowerCase()]) {
    region = SLUG_TO_REGION[slugMatch[1].toLowerCase()]!;
  }
  const regionParam =
    url.searchParams.get("region") ?? url.searchParams.get("server");
  if (!region && regionParam) {
    const slug = regionParam.toLowerCase();
    if (SLUG_TO_REGION[slug]) region = SLUG_TO_REGION[slug]!;
  }
  if (!region) region = "WEST";

  const summonersParam =
    url.searchParams.get("summoners") ??
    url.searchParams.get("summoner") ??
    "";
  const riotIds = dedupeRiotIds(
    splitRiotIdList(summonersParam)
      .map(normalizeRiotId)
      .filter((id): id is string => Boolean(id)),
  );

  return { region, riotIds };
}

/**
 * Parse an OP.GG multisearch URL or plain Riot ID list.
 * `fallbackRegion` is used when the input is plain text (no URL region).
 */
export function parseScoutingInput(
  input: string,
  fallbackRegion: PlayerRegion = "WEST",
): ScoutingParseResult {
  const warnings: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      region: fallbackRegion,
      riotIds: [],
      truncated: 0,
      regionSource: "fallback",
      warnings: ["Paste an OP.GG multisearch URL or Riot IDs (Name#TAG)."],
    };
  }

  const fromUrl = parseOpGgMultisearch(trimmed);
  let region: PlayerRegion;
  let regionSource: "url" | "fallback";
  let rawIds: string[];

  if (fromUrl) {
    region = fromUrl.region;
    regionSource = "url";
    rawIds = fromUrl.riotIds;
    if (rawIds.length === 0) {
      warnings.push(
        "Could not read summoners from the URL. Check the summoners= query param.",
      );
    }
  } else {
    region = fallbackRegion;
    regionSource = "fallback";
    rawIds = [];
    for (const part of splitRiotIdList(trimmed)) {
      const id = normalizeRiotId(part);
      if (id) rawIds.push(id);
      else if (part.length > 0) {
        warnings.push(`Skipped invalid Riot ID: ${part}`);
      }
    }
    rawIds = dedupeRiotIds(rawIds);
  }

  const truncated = Math.max(0, rawIds.length - SCOUTING_MAX_PLAYERS);
  if (truncated > 0) {
    warnings.push(
      `Using first ${SCOUTING_MAX_PLAYERS} players (${truncated} ignored).`,
    );
  }

  return {
    region,
    riotIds: rawIds.slice(0, SCOUTING_MAX_PLAYERS),
    truncated,
    regionSource,
    warnings,
  };
}

export function regionFromOpGgSlug(slug: string): PlayerRegion | null {
  return SLUG_TO_REGION[slug.toLowerCase()] ?? null;
}

export function opGgSlugForRegion(region: PlayerRegion): string {
  return REGION_META[region].opGgSlug;
}
