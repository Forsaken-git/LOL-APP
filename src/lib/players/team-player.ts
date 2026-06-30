import type { Prisma } from "@prisma/client";

/** Enemy placeholders created from match ingest — not real roster members. */
export function isOpponentPlaceholder(player: {
  externalId: string | null;
}): boolean {
  return player.externalId?.startsWith("opponent:") ?? false;
}

export function isTeamRosterPlayer(player: {
  externalId: string | null;
}): boolean {
  return !isOpponentPlaceholder(player);
}

const notOpponentPlaceholder: Prisma.PlayerWhereInput = {
  OR: [{ externalId: null }, { NOT: { externalId: { startsWith: "opponent:" } } }],
};

export const activeTeamPlayerWhere: Prisma.PlayerWhereInput = {
  active: true,
  ...notOpponentPlaceholder,
};

export const hiddenTeamPlayerWhere: Prisma.PlayerWhereInput = {
  active: false,
  ...notOpponentPlaceholder,
};
