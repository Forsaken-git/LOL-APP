import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildMatchScoreboard } from "@/lib/match-scoreboard";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      participants: { include: { player: true } },
      pickBans: { orderBy: { order: "asc" } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const scoreboard = buildMatchScoreboard(match);

  return NextResponse.json({ scoreboard });
}
