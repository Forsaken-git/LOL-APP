import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTierlistById, setTierlistPlayerId } from "@/lib/tierlist-db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { name, rows, playerId } = body;

  const existing = await getTierlistById(id);
  if (!existing) {
    return NextResponse.json({ error: "Tierlist not found" }, { status: 404 });
  }

  if (typeof playerId === "string" && playerId.length > 0) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
  }

  try {
    await prisma.tierlist.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(rows && {
          rows: typeof rows === "string" ? rows : JSON.stringify(rows),
        }),
      },
    });

    if (playerId !== undefined) {
      const nextPlayerId =
        typeof playerId === "string" && playerId.length > 0 ? playerId : null;
      await setTierlistPlayerId(id, nextPlayerId);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const tierlist = await getTierlistById(id);
  if (!tierlist) {
    return NextResponse.json({ error: "Tierlist not found" }, { status: 404 });
  }

  let player = null;
  if (tierlist.playerId) {
    player = await prisma.player.findUnique({
      where: { id: tierlist.playerId },
      select: { id: true, displayName: true, teamRole: true },
    });
  }

  return NextResponse.json({ ...tierlist, player });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.tierlist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
