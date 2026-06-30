import type { PickBanType, Side } from "@prisma/client";

export type PickBanLike = {
  champion: string;
  type: PickBanType;
  side: Side;
  order: number;
};

/** Match already has meaningful pick/ban data (e.g. LCU champ select). */
export function matchHasCapturedPickBans(
  source: string | null | undefined,
  pickBans: PickBanLike[],
): boolean {
  if (pickBans.length === 0) return false;

  const banCount = pickBans.filter((p) => p.type === "BAN").length;
  if (banCount > 0) return true;

  if ((source ?? "").toLowerCase().includes("lcu")) return true;

  return pickBans.length >= 10;
}
