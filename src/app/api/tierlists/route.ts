import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  attachPlayersToTierlists,
  getTierlistById,
  listActivePlayers,
  listAllTierlists,
  setTierlistPlayerId,
} from "@/lib/tierlist-db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");

  const [tierlists, players] = await Promise.all([
    listAllTierlists(),
    listActivePlayers(),
  ]);

  const filtered = playerId
    ? tierlists.filter((t) => t.playerId === playerId)
    : tierlists;

  return NextResponse.json(attachPlayersToTierlists(filtered, players));
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, category, rows, playerId } = body;

  if (!name || !rows) {
    return NextResponse.json(
      { error: "name and rows are required" },
      { status: 400 },
    );
  }

  if (!playerId || typeof playerId !== "string") {
    return NextResponse.json(
      { error: "playerId is required" },
      { status: 400 },
    );
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  try {
    const tierlist = await prisma.tierlist.create({
      data: {
        name,
        category: category ?? "champions",
        rows: typeof rows === "string" ? rows : JSON.stringify(rows),
      },
    });

    await setTierlistPlayerId(tierlist.id, playerId);

    const saved = await getTierlistById(tierlist.id);
    return NextResponse.json(
      {
        ...saved,
        player: {
          id: player.id,
          displayName: player.displayName,
          teamRole: player.teamRole,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
