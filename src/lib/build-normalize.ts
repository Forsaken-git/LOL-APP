import type { LoLRole } from "@prisma/client";
import type { ParticipantBuild } from "@/lib/ingest/types";
import { canonicalItemId, isBootItemId, isTrinketItemId } from "@/lib/items";

const JUNGLE_PET_IDS = new Set([1101, 1102, 1103, 1105, 1106, 1107]);
const SUPPORT_QUEST_ITEM_IDS = new Set([
  3850, 3851, 3853, 3854, 3855, 3857, 3858,
]);

/** Lane quest rewards (TOP/MID/BOT/JG) — must not stay in the 6-item grid. */
const LANE_QUEST_ITEM_IDS = new Set([
  1205, 1206, 1207, 1208, 1209, 1210, 1211, 1220, 1221,
]);

const LANE_BY_INDEX = ["TOP", "JG", "MID", "ADC", "SUPP"] as const;
const ADC_LANE_INDEX = 3;

/** Stealth Ward — default when manual entry omits the trinket field. */
export const DEFAULT_STEALTH_WARD = 3340;

export function scoreboardRoleForLaneIndex(laneIndex: number): string {
  return LANE_BY_INDEX[laneIndex] ?? "—";
}

export function laneIndexFromPosition(position: string | null | undefined): number {
  const p = (position ?? "").toUpperCase();
  if (p === "TOP") return 0;
  if (p === "JUNGLE") return 1;
  if (p === "MIDDLE" || p === "MID") return 2;
  if (p === "BOTTOM" || p === "ADC") return 3;
  if (p === "UTILITY" || p === "SUPPORT") return 4;
  return 0;
}

/** Normalize manual/import builds and ensure a trinket is stored for the scoreboard column. */
export function finalizeParticipantBuild(
  build: ParticipantBuild | null | undefined,
  ctx: NormalizeBuildContext,
): ParticipantBuild | null {
  const normalized = normalizeParticipantBuild(build, ctx);
  if (!normalized) return null;
  if (normalized.trinketItemId != null) return normalized;
  return { ...normalized, trinketItemId: DEFAULT_STEALTH_WARD };
}

export type NormalizeBuildContext = {
  position?: string | null;
  teamRole?: LoLRole | string | null;
  laneIndex?: number;
  /** Lane label from scoreboard row (TOP/JG/MID/ADC/SUPP) — most reliable for layout. */
  scoreboardRole?: string | null;
};

/** Scoreboard lane label used for quest/item layout rules. */
export function resolveScoreboardRole(ctx: NormalizeBuildContext): string {
  const scoreboard = (ctx.scoreboardRole ?? "").toUpperCase();
  if (scoreboard === "TOP") return "TOP";
  if (scoreboard === "JG" || scoreboard === "JUNGLE") return "JG";
  if (scoreboard === "MID" || scoreboard === "MIDDLE") return "MID";
  if (scoreboard === "ADC" || scoreboard === "BOTTOM") return "ADC";
  if (scoreboard === "SUPP" || scoreboard === "SUPPORT" || scoreboard === "UTILITY") {
    return "SUPP";
  }

  const p = (ctx.position ?? "").toUpperCase();
  if (p === "TOP") return "TOP";
  if (p === "JUNGLE") return "JG";
  if (p === "MIDDLE" || p === "MID") return "MID";
  if (p === "BOTTOM" || p === "ADC") return "ADC";
  if (p === "UTILITY" || p === "SUPPORT") return "SUPP";

  if (ctx.laneIndex != null && ctx.laneIndex >= 0 && ctx.laneIndex < LANE_BY_INDEX.length) {
    return LANE_BY_INDEX[ctx.laneIndex];
  }

  const role = (ctx.teamRole ?? "").toString().toUpperCase();
  if (role === "TOP") return "TOP";
  if (role === "JUNGLE") return "JG";
  if (role === "MID") return "MID";
  if (role === "ADC") return "ADC";
  if (role === "SUPPORT") return "SUPP";
  return "—";
}

export function isAdcRole(role: string, laneIndex?: number): boolean {
  return role === "ADC" || laneIndex === ADC_LANE_INDEX;
}

/** Collect every item id from a build (any slot / field). */
function allItemIds(build: ParticipantBuild): number[] {
  const merged: number[] = [];
  const seen = new Set<number>();
  for (const id of [
    ...(build.itemIds ?? []),
    ...(build.questItemId != null ? [build.questItemId] : []),
    ...(build.trinketItemId != null ? [build.trinketItemId] : []),
  ]) {
    if (typeof id === "number" && id > 0) {
      const canonical = canonicalItemId(id);
      if (!seen.has(canonical)) {
        seen.add(canonical);
        merged.push(canonical);
      }
    }
  }
  return merged;
}

/**
 * ADC rule: boots always live in the quest slot — strip them from inventory and trinket.
 * Returns the boot id to show in quest (last boot found wins) and the remaining ids.
 */
function partitionAdcItems(ids: number[]): {
  questBoots: number | null;
  trinketItemId: number | null;
  coreItems: number[];
} {
  let questBoots: number | null = null;
  let trinketItemId: number | null = null;
  const coreItems: number[] = [];

  for (const id of ids) {
    if (isBootItemId(id)) {
      questBoots = id;
      continue;
    }
    if (isTrinketItemId(id)) {
      if (trinketItemId == null) trinketItemId = id;
      continue;
    }
    coreItems.push(id);
  }

  return { questBoots, trinketItemId, coreItems };
}

/**
 * Normalize stored build JSON: core items in `itemIds`, ADC boots in `questItemId`,
 * trinket in `trinketItemId`. Safe to call on ingest, manual save, and read paths.
 */
export function normalizeParticipantBuild(
  build: ParticipantBuild | null | undefined,
  ctx: NormalizeBuildContext = {},
): ParticipantBuild | null {
  if (!build) return null;

  const role = resolveScoreboardRole(ctx);
  const adc = isAdcRole(role, ctx.laneIndex);
  const ids = allItemIds(build);

  let questItemId: number | undefined;
  let trinketItemId: number | undefined;
  let coreItems: number[];

  if (adc) {
    const partitioned = partitionAdcItems(ids);
    questItemId = partitioned.questBoots ?? undefined;
    trinketItemId = partitioned.trinketItemId ?? undefined;
    coreItems = partitioned.coreItems;
  } else {
    coreItems = [];
    for (const id of ids) {
      if (
        (SUPPORT_QUEST_ITEM_IDS.has(id) ||
          LANE_QUEST_ITEM_IDS.has(id) ||
          JUNGLE_PET_IDS.has(id)) &&
        questItemId == null
      ) {
        questItemId = id;
        continue;
      }
      if (isTrinketItemId(id) && trinketItemId == null) {
        trinketItemId = id;
        continue;
      }
      coreItems.push(id);
    }
  }

  const itemIds = coreItems.slice(0, 6);

  const hasSpells =
    typeof build.spell1Id === "number" || typeof build.spell2Id === "number";
  const hasPerks = !!build.perks;
  if (
    itemIds.length === 0 &&
    questItemId == null &&
    trinketItemId == null &&
    !hasSpells &&
    !hasPerks
  ) {
    return null;
  }

  return {
    spell1Id: build.spell1Id,
    spell2Id: build.spell2Id,
    perks: build.perks,
    itemIds,
    ...(questItemId != null ? { questItemId } : {}),
    ...(trinketItemId != null ? { trinketItemId } : {}),
  };
}

export type ScoreboardItemLayout = {
  questItemId: number | null;
  trinketItemId: number | null;
  coreItems: number[];
};

/** Layout for scoreboard UI (includes synthetic role quest icons). */
export function layoutBuildForScoreboard(
  build: ParticipantBuild | null | undefined,
  ctx: NormalizeBuildContext,
): ScoreboardItemLayout {
  const role = resolveScoreboardRole(ctx);
  const normalized = normalizeParticipantBuild(build, ctx);

  let questItemId = normalized?.questItemId ?? null;
  let trinketItemId = normalized?.trinketItemId ?? null;
  const coreItems = [...(normalized?.itemIds ?? [])];

  // ADC: always quest slot for boots (normalize already did this; safety pass).
  if (isAdcRole(role, ctx.laneIndex)) {
    const repartitioned = partitionAdcItems([
      ...coreItems,
      ...(questItemId != null ? [questItemId] : []),
      ...(trinketItemId != null ? [trinketItemId] : []),
    ]);
    questItemId = repartitioned.questBoots;
    trinketItemId = repartitioned.trinketItemId;
    coreItems.length = 0;
    coreItems.push(...repartitioned.coreItems);
  } else if (questItemId != null && isBootItemId(questItemId)) {
    coreItems.push(questItemId);
    questItemId = null;
  }

  if (questItemId == null && role === "JG") {
    const petIndex = coreItems.findIndex((id) => JUNGLE_PET_IDS.has(id));
    if (petIndex !== -1) {
      questItemId = coreItems[petIndex];
      coreItems.splice(petIndex, 1);
    } else {
      questItemId = 1101;
    }
  }

  // UI placeholder when game data has no lane quest item (not stored in DB).
  if (questItemId == null && role === "TOP") questItemId = 1221;
  if (questItemId == null && role === "MID") questItemId = 1206;
  if (questItemId == null && role === "SUPP") questItemId = 1208;

  return {
    questItemId,
    trinketItemId,
    coreItems: coreItems.slice(0, 6),
  };
}

/** Expand normalized build for manual edit form (7th slot = ADC boots). */
export function expandBuildForEditor(
  build: ParticipantBuild | null | undefined,
  ctx: NormalizeBuildContext,
): { itemIds: number[]; trinketItemId: string } {
  const normalized = normalizeParticipantBuild(build, ctx);
  if (!normalized) {
    return { itemIds: [], trinketItemId: "" };
  }

  const itemIds = [...normalized.itemIds];

  if (
    isAdcRole(resolveScoreboardRole(ctx), ctx.laneIndex) &&
    normalized.questItemId != null &&
    isBootItemId(normalized.questItemId)
  ) {
    itemIds.push(normalized.questItemId);
  }

  return {
    itemIds,
    trinketItemId:
      normalized.trinketItemId != null ? String(normalized.trinketItemId) : "",
  };
}
