import type { DraftLane } from "./draft-positions.generated";
import {
  DRAFT_LANE_ORDER,
  DRAFT_POSITIONS_BY_CHAMPION,
  PRIMARY_DRAFT_POSITION,
} from "./draft-positions.generated";

export type { DraftLane };
export { DRAFT_LANE_ORDER };

/** All draft lanes a champion is listed for on the LoL Wiki. */
export function draftLanesForChampion(champion: string): readonly DraftLane[] {
  return DRAFT_POSITIONS_BY_CHAMPION[champion] ?? [];
}

/** Primary lane for sorting (first wiki lane in Top → Support order). */
export function primaryDraftLane(champion: string): DraftLane | null {
  return PRIMARY_DRAFT_POSITION[champion] ?? null;
}

export function championPlaysDraftLane(
  champion: string,
  lane: DraftLane,
): boolean {
  return draftLanesForChampion(champion).includes(lane);
}

function laneSortIndex(champion: string): number {
  const lane = primaryDraftLane(champion);
  if (!lane) return DRAFT_LANE_ORDER.length;
  return DRAFT_LANE_ORDER.indexOf(lane);
}

/** Sort like the wiki draft-position list: by lane, then name. */
export function sortChampionsByDraftPosition(
  champions: readonly string[],
): string[] {
  return [...champions].sort((a, b) => {
    const laneDiff = laneSortIndex(a) - laneSortIndex(b);
    if (laneDiff !== 0) return laneDiff;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}

export function filterChampionsByDraftLane(
  champions: readonly string[],
  lane: DraftLane | null,
): string[] {
  if (!lane) return [...champions];
  return champions.filter((c) => championPlaysDraftLane(c, lane));
}
