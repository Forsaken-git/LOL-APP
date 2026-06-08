import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDraftComplete, parseDraftEntries, serializeDraftEntries } from "@/lib/draft";

export async function GET() {
  const drafts = await prisma.draftSession.findMany({
    orderBy: { scheduledAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    drafts.map((d) => {
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
    }),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title, opponent, league, scheduledAt, ourSide, notes } = body as {
    title?: string;
    opponent?: string;
    league?: string;
    scheduledAt?: string;
    ourSide?: "BLUE" | "RED";
    notes?: string;
  };

  if (!title?.trim() || !scheduledAt) {
    return NextResponse.json(
      { error: "title and scheduledAt are required" },
      { status: 400 },
    );
  }

  const draft = await prisma.draftSession.create({
    data: {
      title: title.trim(),
      opponent: opponent?.trim() || null,
      league: league?.trim() || "Scrim",
      scheduledAt: new Date(scheduledAt),
      ourSide: ourSide === "RED" ? "RED" : "BLUE",
      notes: notes?.trim() || null,
      pickBans: serializeDraftEntries([]),
      status: "PLANNING",
      matchId: null,
    },
  });

  return NextResponse.json(
    {
      ...draft,
      scheduledAt: draft.scheduledAt.toISOString(),
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
      entries: [],
      progress: 0,
      complete: false,
    },
    { status: 201 },
  );
}
