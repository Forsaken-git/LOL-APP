import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadPlayerSoloQAdvanced,
  syncPlayerSoloQAdvanced,
} from "@/lib/stats/soloq-advanced-sync";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Read SoloQ advanced metrics from Match-V5 / LP cache (not LCU team games). */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const player = await prisma.player.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const metrics = await loadPlayerSoloQAdvanced(id);
    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("[players/soloq-advanced GET]", error);
    return NextResponse.json(
      { error: "Failed to load SoloQ advanced stats" },
      { status: 500 },
    );
  }
}

/** Sync Match-V5 match summaries + rank snapshot for this player’s Riot accounts. */
export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const synced = await syncPlayerSoloQAdvanced(id);
    if (!synced.ok) {
      return NextResponse.json(
        { error: synced.error },
        { status: synced.status },
      );
    }
    return NextResponse.json(synced.result);
  } catch (error) {
    console.error("[players/soloq-advanced POST]", error);
    return NextResponse.json(
      { error: "Failed to sync SoloQ advanced stats" },
      { status: 500 },
    );
  }
}
