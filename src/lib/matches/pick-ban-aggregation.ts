import type { PickBanType, Side } from "@prisma/client";
import { isDraftComplete, parseDraftEntries } from "@/lib/draft";
import { gameMatchesDraft } from "@/lib/matches/opponent-key";

export type PickBanStatEntry = {
  champion: string;
  type: PickBanType;
};

type MatchPickBanRow = {
  champion: string;
  type: PickBanType;
  side: Side;
  matchId: string;
  match: {
    side: Side;
    opponent: string | null;
    league: string;
    playedAt: Date;
  };
};

type DraftRow = {
  id: string;
  pickBans: string;
  ourSide: Side;
  matchId: string | null;
  opponent: string | null;
  league: string;
  scheduledAt: Date;
};

/**
 * Build our-side pick/ban stats without double-counting planner drafts
 * that describe the same game as an already-ingested match.
 */
export function aggregateOurPickBans(input: {
  matchPickBans: MatchPickBanRow[];
  drafts: DraftRow[];
}): PickBanStatEntry[] {
  const ourMatchPickBans = input.matchPickBans.filter(
    (p) => p.side === p.match.side,
  );

  const matchesCoveringDraft = new Set<string>();
  for (const draft of input.drafts) {
    if (draft.matchId) continue;
    const entries = parseDraftEntries(draft.pickBans);
    if (!isDraftComplete(entries)) continue;

    const covered = ourMatchPickBans.some((p) =>
      gameMatchesDraft(p.match, draft),
    );
    if (covered) matchesCoveringDraft.add(draft.id);
  }

  const fromMatches = ourMatchPickBans.map((p) => ({
    champion: p.champion,
    type: p.type,
  }));

  const fromDrafts = input.drafts.flatMap((draft) => {
    if (draft.matchId) return [];
    if (matchesCoveringDraft.has(draft.id)) return [];

    const entries = parseDraftEntries(draft.pickBans);
    if (!isDraftComplete(entries)) return [];
    return entries
      .filter((e) => e.side === draft.ourSide)
      .map((e) => ({ champion: e.champion, type: e.type }));
  });

  return [...fromMatches, ...fromDrafts];
}

export function summarizePickBanSources(input: {
  matchPickBans: MatchPickBanRow[];
  drafts: DraftRow[];
}): {
  entries: PickBanStatEntry[];
  linkedDraftCount: number;
  countedDraftCount: number;
  skippedDuplicateDraftCount: number;
} {
  const ourMatchPickBans = input.matchPickBans.filter(
    (p) => p.side === p.match.side,
  );

  const matchesCoveringDraft = new Set<string>();
  for (const draft of input.drafts) {
    if (draft.matchId) continue;
    const entries = parseDraftEntries(draft.pickBans);
    if (!isDraftComplete(entries)) continue;
    if (ourMatchPickBans.some((p) => gameMatchesDraft(p.match, draft))) {
      matchesCoveringDraft.add(draft.id);
    }
  }

  const completeUnlinkedDrafts = input.drafts.filter((d) => {
    if (d.matchId) return false;
    return isDraftComplete(parseDraftEntries(d.pickBans));
  });

  return {
    entries: aggregateOurPickBans(input),
    linkedDraftCount: input.drafts.filter((d) => d.matchId).length,
    countedDraftCount: completeUnlinkedDrafts.filter(
      (d) => !matchesCoveringDraft.has(d.id),
    ).length,
    skippedDuplicateDraftCount: completeUnlinkedDrafts.filter((d) =>
      matchesCoveringDraft.has(d.id),
    ).length,
  };
}
