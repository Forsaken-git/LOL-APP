import type { PickBanType, Side } from "@prisma/client";
import { championDisplayName } from "@/lib/champions";
import { prisma } from "@/lib/prisma";

export type PickBanInput = {
  champion: string;
  type: PickBanType;
  side: Side;
  order: number;
};

export async function replaceMatchPickBans(
  matchId: string,
  rows: PickBanInput[],
): Promise<void> {
  const normalized = rows
    .map((row, index) => ({
      champion: championDisplayName(row.champion.trim()),
      type: row.type,
      side: row.side,
      order: Number.isFinite(row.order) ? row.order : index,
    }))
    .filter((row) => row.champion && row.champion !== "Unknown");

  await prisma.$transaction(async (tx) => {
    await tx.pickBan.deleteMany({ where: { matchId } });
    if (normalized.length === 0) return;
    await tx.pickBan.createMany({
      data: normalized.map((row) => ({ matchId, ...row })),
    });
  });
}
