import type { LoLRole, Side } from "@prisma/client";
import {
  laneIndexFromPosition,
  normalizeParticipantBuild,
  scoreboardRoleForLaneIndex,
} from "@/lib/build-normalize";
import { championDisplayName } from "@/lib/champions";
import { rosterEntryFor, rosterExternalId } from "@/lib/team-roster";
import type { IngestParticipant, ParticipantBuild } from "./types";

/** Raw player object from LCU `/lol-end-of-game/v1/eog-stats-block`. */
export type EogPlayerRaw = {
  championId?: number;
  championName?: string;
  summonerName?: string;
  riotIdGameName?: string;
  riotIdTagLine?: string;
  detectedTeamPosition?: string;
  teamId?: number;
  items?: number[];
  spell1Id?: number;
  spell2Id?: number;
  stats?: Record<string, number>;
};

export type EogTeamRaw = {
  teamId: number;
  isPlayerTeam?: boolean;
  isWinningTeam?: boolean;
  players?: EogPlayerRaw[];
  championBans?: number[];
};

export type EogStatsRaw = {
  gameId?: number;
  gameLength?: number;
  teams?: EogTeamRaw[];
};

export function eogRiotId(p: EogPlayerRaw): string {
  const game = p.riotIdGameName?.trim();
  if (!game) return p.summonerName?.trim() ?? "";
  const tag = p.riotIdTagLine?.trim();
  return tag ? `${game}#${tag}` : game;
}

export function eogDisplayName(p: EogPlayerRaw): string {
  return (
    p.riotIdGameName?.trim() ||
    p.summonerName?.split("#")[0]?.trim() ||
    "Unknown"
  );
}

export function eogPositionToRole(pos?: string): LoLRole {
  switch ((pos ?? "").toUpperCase()) {
    case "TOP":
      return "TOP";
    case "JUNGLE":
      return "JUNGLE";
    case "MIDDLE":
    case "MID":
      return "MID";
    case "BOTTOM":
    case "ADC":
      return "ADC";
    case "UTILITY":
    case "SUPPORT":
      return "SUPPORT";
    default:
      return "FILL";
  }
}

const ITEM_SLOT_COUNT = 8;

function appendItemId(itemIds: number[], seen: Set<number>, id: number): void {
  if (id > 0 && !seen.has(id)) {
    seen.add(id);
    itemIds.push(id);
  }
}

/** Prefer stats.ITEM0..ITEM7 so ADC boot / trinket slots are not dropped. */
function collectItemIds(p: EogPlayerRaw): number[] {
  const stats = p.stats ?? {};
  const itemIds: number[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < ITEM_SLOT_COUNT; i++) {
    const slot = stats[`ITEM${i}`];
    if (typeof slot === "number" && slot > 0) {
      appendItemId(itemIds, seen, slot);
    }
  }
  for (const id of p.items ?? []) {
    if (typeof id === "number" && id > 0) {
      appendItemId(itemIds, seen, id);
    }
  }
  return itemIds;
}

export function extractBuild(p: EogPlayerRaw): ParticipantBuild | undefined {
  const stats = p.stats ?? {};
  const itemIds = collectItemIds(p);

  const slots: number[] = [];
  for (let i = 0; i < 6; i++) {
    const id = stats[`PERK${i}`];
    if (typeof id === "number" && id > 0) slots.push(id);
  }
  const primaryStyle = stats.PERK_PRIMARY_STYLE;
  const subStyle = stats.PERK_SUB_STYLE;

  const hasPerks =
    slots.length > 0 ||
    (typeof primaryStyle === "number" && primaryStyle > 0);
  const hasSpells =
    (typeof p.spell1Id === "number" && p.spell1Id > 0) ||
    (typeof p.spell2Id === "number" && p.spell2Id > 0);

  if (itemIds.length === 0 && !hasPerks && !hasSpells) return undefined;

  const raw: ParticipantBuild = {
    itemIds,
    spell1Id: p.spell1Id,
    spell2Id: p.spell2Id,
    perks: hasPerks
      ? {
          primaryStyle:
            typeof primaryStyle === "number" ? primaryStyle : undefined,
          subStyle: typeof subStyle === "number" ? subStyle : undefined,
          slots,
        }
      : undefined,
  };

  const laneIndex = laneIndexFromPosition(p.detectedTeamPosition);
  return (
    normalizeParticipantBuild(raw, {
      position: p.detectedTeamPosition,
      teamRole: eogPositionToRole(p.detectedTeamPosition),
      laneIndex,
      scoreboardRole: scoreboardRoleForLaneIndex(laneIndex),
    }) ?? undefined
  );
}

export function extractParticipantFromEogPlayer(
  p: EogPlayerRaw,
  side: Side,
  isOpponent: boolean,
): IngestParticipant {
  const stats = p.stats ?? {};
  const cs =
    (stats.MINIONS_KILLED ?? 0) + (stats.NEUTRAL_MINIONS_KILLED ?? 0);
  const build = extractBuild(p);
  const summonerName = eogRiotId(p) || undefined;
  const displayName = eogDisplayName(p);

  let playerExternalId: string | undefined;
  if (!isOpponent && (summonerName || displayName)) {
    const roster = rosterEntryFor({ summonerName, displayName });
    if (roster) {
      playerExternalId = roster.externalId ?? rosterExternalId(roster);
    }
  }

  return {
    displayName,
    summonerName,
    playerExternalId,
    champion: championDisplayName(p.championName ?? "Unknown"),
    side,
    opponent: isOpponent,
    teamRole: eogPositionToRole(p.detectedTeamPosition),
    position: p.detectedTeamPosition,
    kills: stats.CHAMPIONS_KILLED ?? 0,
    deaths: stats.NUM_DEATHS ?? 0,
    assists: stats.ASSISTS ?? 0,
    cs,
    damage: stats.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS ?? 0,
    goldEarned: stats.GOLD_EARNED ?? undefined,
    visionScore: stats.VISION_SCORE ?? undefined,
    build,
  };
}
