import type { Prisma } from "@prisma/client";
import type { DraftEntry } from "@/lib/draft";
import { gameMatchesDraft } from "@/lib/matches/opponent-key";
import { matchHasCapturedPickBans } from "@/lib/matches/pick-ban-capture";
import { prisma } from "@/lib/prisma";

export type PickBanSyncResult = "synced" | "preserved" | "skipped";

type Tx = Prisma.TransactionClient;

export async function maybeSyncDraftPickBansToMatch(
  tx: Tx,
  matchId: string,
  entries: DraftEntry[],
  options: { force?: boolean },
): Promise<PickBanSyncResult> {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    include: { pickBans: { orderBy: { order: "asc" } } },
  });
  if (!match) return "skipped";

  if (
    !options.force &&
    matchHasCapturedPickBans(match.source, match.pickBans)
  ) {
    return "preserved";
  }

  if (entries.length === 0) return "skipped";

  await tx.pickBan.deleteMany({ where: { matchId } });
  await tx.pickBan.createMany({
    data: entries.map((e, i) => ({
      matchId,
      champion: e.champion,
      type: e.type,
      side: e.side,
      order: e.order ?? i,
    })),
  });
  return "synced";
}

/** Link an unlinked draft to an ingested match when it is clearly the same game. */
export async function tryAutoLinkDraftToMatch(matchId: string): Promise<string | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      opponent: true,
      league: true,
      playedAt: true,
      source: true,
      pickBans: true,
      draft: { select: { id: true } },
    },
  });
  if (!match || match.draft) return null;
  if (!matchHasCapturedPickBans(match.source, match.pickBans)) return null;

  const candidates = await prisma.draftSession.findMany({
    where: { matchId: null },
    orderBy: { scheduledAt: "desc" },
    take: 30,
  });

  const draft = candidates.find((d) => gameMatchesDraft(match, d));
  if (!draft) return null;

  await prisma.draftSession.update({
    where: { id: draft.id },
    data: { matchId: match.id, status: "PLAYED" },
  });

  return draft.id;
}
