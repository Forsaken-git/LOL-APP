import type { Side } from "@prisma/client";
import { championDisplayName } from "@/lib/champions";

const POSITION_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

function positionIndex(position: string | null | undefined): number {
  const p = (position ?? "").toUpperCase();
  const i = POSITION_ORDER.indexOf(p);
  return i === -1 ? 99 : i;
}

export type MatchParticipantLike = {
  champion: string;
  side: Side | null;
  position?: string | null;
  player: { active: boolean };
};

/** Participants that belong to our roster for this match. */
export function ourTeamParticipants<T extends MatchParticipantLike>(
  participants: T[],
  matchSide: Side,
): T[] {
  return participants.filter(
    (p) => p.side === matchSide || (p.side == null && p.player.active),
  );
}

/** Normalized champion names our team played, lane order when positions exist. */
export function ourTeamChampionNames(
  participants: MatchParticipantLike[],
  matchSide: Side,
): string[] {
  const ours = ourTeamParticipants(participants, matchSide);
  return [...ours]
    .sort(
      (a, b) =>
        positionIndex(a.position) - positionIndex(b.position),
    )
    .map((p) => championDisplayName(p.champion))
    .filter((name) => name && name !== "Unknown");
}
