import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteMatchById } from "@/lib/match-delete";
import { buildMatchScoreboard } from "@/lib/match-scoreboard";
import { parseManualMatchBody } from "@/lib/matches/parse-body";
import { updateManualMatch } from "@/lib/matches/create-manual";

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
  const enemySide = match.side === "BLUE" ? "RED" : "BLUE";
  const enemyPlayers = match.participants
    .filter((p) => p.side === enemySide)
    .map((p) => ({
      participantId: p.id,
      playerId: p.playerId,
      champion: p.champion,
      name: p.player.displayName,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.cs,
      damage: p.damage,
      goldEarned: p.goldEarned,
      visionScore: p.visionScore,
    }));

  return NextResponse.json({ scoreboard, enemyPlayers });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.match.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  await deleteMatchById(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    enemyPlayers?: {
      participantId: string;
      name: string;
      champion?: string;
      kills?: number | string | null;
      deaths?: number | string | null;
      assists?: number | string | null;
      cs?: number | string | null;
      damage?: number | string | null;
      goldEarned?: number | string | null;
      visionScore?: number | string | null;
    }[];
  } | null;
  const edits = body?.enemyPlayers;
  if (!Array.isArray(edits) || edits.length === 0) {
    return NextResponse.json(
      { error: "enemyPlayers is required" },
      { status: 400 },
    );
  }

  const match = await prisma.match.findUnique({
    where: { id },
    include: { participants: { include: { player: true } } },
  });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  const enemySide = match.side === "BLUE" ? "RED" : "BLUE";
  const enemyByParticipantId = new Map(
    match.participants
      .filter((p) => p.side === enemySide)
      .map((p) => [p.id, p]),
  );
  const toInt = (v: number | string | null | undefined): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
  };

  for (const edit of edits) {
    const part = enemyByParticipantId.get(edit.participantId);
    if (!part) continue;
    const name = edit.name.trim();
    await prisma.matchParticipant.update({
      where: { id: part.id },
      data: {
        champion: edit.champion?.trim() || part.champion,
        kills: toInt(edit.kills),
        deaths: toInt(edit.deaths),
        assists: toInt(edit.assists),
        cs: toInt(edit.cs),
        damage: toInt(edit.damage),
        goldEarned: toInt(edit.goldEarned),
        visionScore: toInt(edit.visionScore),
      },
    });
    if (name) {
      await prisma.player.update({
        where: { id: part.playerId },
        data: { displayName: name },
      });
    }
  }

  const updated = await prisma.match.findUnique({
    where: { id },
    include: {
      participants: { include: { player: true } },
      pickBans: { orderBy: { order: "asc" } },
    },
  });
  if (!updated) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const scoreboard = buildMatchScoreboard(updated);
  const refreshedEnemySide = updated.side === "BLUE" ? "RED" : "BLUE";
  const enemyPlayers = updated.participants
    .filter((p) => p.side === refreshedEnemySide)
    .map((p) => ({
      participantId: p.id,
      playerId: p.playerId,
      champion: p.champion,
      name: p.player.displayName,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.cs,
      damage: p.damage,
      goldEarned: p.goldEarned,
      visionScore: p.visionScore,
    }));

  return NextResponse.json({ scoreboard, enemyPlayers });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.match.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

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
    await updateManualMatch(id, parsed.data);
    return NextResponse.json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update match";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
