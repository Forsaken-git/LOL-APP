import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ourTeamChampionNames } from "@/lib/matches/our-team-champions";
import { createManualMatch } from "@/lib/matches/create-manual";
import { parseManualMatchBody } from "@/lib/matches/parse-body";

export async function GET() {
  const matches = await prisma.match.findMany({
    orderBy: { playedAt: "desc" },
    take: 120,
    select: {
      id: true,
      playedAt: true,
      league: true,
      opponent: true,
      side: true,
      result: true,
      draft: { select: { id: true } },
      participants: {
        select: {
          champion: true,
          side: true,
          position: true,
          player: { select: { active: true } },
        },
      },
    },
  });

  return NextResponse.json(
    matches.map((m) => ({
      id: m.id,
      playedAt: m.playedAt.toISOString(),
      league: m.league,
      opponent: m.opponent,
      side: m.side,
      result: m.result,
      linkedDraftId: m.draft?.id ?? null,
      championPool: Array.from(
        new Set(ourTeamChampionNames(m.participants, m.side)),
      ),
    })),
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseManualMatchBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { id } = await createManualMatch(parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    console.error("POST /api/matches", e);
    const message =
      e instanceof Error ? e.message : "Failed to create match";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
