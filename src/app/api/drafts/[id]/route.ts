import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isDraftComplete,
  parseDraftEntries,
  serializeDraftEntries,
  type DraftEntry,
} from "@/lib/draft";
import { maybeSyncDraftPickBansToMatch } from "@/lib/matches/sync-draft-match-pick-bans";

type RouteCtx = { params: Promise<{ id: string }> };

function serializeDraft(d: {
  id: string;
  title: string;
  opponent: string | null;
  league: string;
  scheduledAt: Date;
  ourSide: "BLUE" | "RED";
  status: string;
  pickBans: string;
  notes: string | null;
  matchId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const entries = parseDraftEntries(d.pickBans);
  return {
    ...d,
    scheduledAt: d.scheduledAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    entries,
    progress: entries.length,
    complete: isDraftComplete(entries),
  };
}

export async function GET(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const draft = await prisma.draftSession.findUnique({
    where: { id },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json(serializeDraft(draft));
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const body = await request.json();

  const existing = await prisma.draftSession.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const data: {
    title?: string;
    opponent?: string | null;
    league?: string;
    scheduledAt?: Date;
    ourSide?: "BLUE" | "RED";
    notes?: string | null;
    pickBans?: string;
    matchId?: string | null;
    status?: "PLANNING" | "READY" | "PLAYED";
  } = {};

  if (typeof body.title === "string") data.title = body.title.trim();
  if (body.opponent !== undefined) {
    data.opponent = body.opponent?.trim() || null;
  }
  if (typeof body.league === "string") data.league = body.league.trim();
  if (typeof body.scheduledAt === "string") {
    data.scheduledAt = new Date(body.scheduledAt);
  }
  if (body.ourSide === "BLUE" || body.ourSide === "RED") data.ourSide = body.ourSide;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  const hasEntriesPatch = Array.isArray(body.entries);
  const forcePickBanSync = body.forcePickBanSync === true;
  let resolvedEntries = parseDraftEntries(existing.pickBans);

  if (hasEntriesPatch) {
    resolvedEntries = (body.entries as DraftEntry[]).map((e, i) => ({
      champion: e.champion,
      type: e.type,
      side: e.side,
      order: e.order ?? i,
    }));
    data.pickBans = serializeDraftEntries(resolvedEntries);
    data.status = isDraftComplete(resolvedEntries) ? "READY" : "PLANNING";
  }

  let targetMatchId = existing.matchId;
  if (body.matchId !== undefined) {
    targetMatchId =
      typeof body.matchId === "string" && body.matchId.trim()
        ? body.matchId.trim()
        : null;

    if (targetMatchId) {
      const match = await prisma.match.findUnique({
        where: { id: targetMatchId },
        select: { id: true },
      });
      if (!match) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
      }

      const conflict = await prisma.draftSession.findFirst({
        where: {
          id: { not: id },
          matchId: targetMatchId,
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "This match is already linked to another draft" },
          { status: 409 },
        );
      }
    }

    data.matchId = targetMatchId;
  }

  const shouldAttemptPickBanSync =
    !!targetMatchId &&
    resolvedEntries.length > 0 &&
    (hasEntriesPatch || body.matchId !== undefined);

  let pickBanSync: "synced" | "preserved" | "skipped" = "skipped";

  const draft = await prisma.$transaction(async (tx) => {
    if (shouldAttemptPickBanSync && targetMatchId) {
      pickBanSync = await maybeSyncDraftPickBansToMatch(
        tx,
        targetMatchId,
        resolvedEntries,
        { force: forcePickBanSync },
      );
    }

    return tx.draftSession.update({
      where: { id },
      data,
    });
  });
  return NextResponse.json({ ...serializeDraft(draft), pickBanSync });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const existing = await prisma.draftSession.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  await prisma.draftSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
