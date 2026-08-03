import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadPlayerSoloQAdvanced,
  syncPlayerSoloQAdvanced,
} from "@/lib/stats/soloq-advanced-sync";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function publicErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message || fallback;
  // Prisma: missing column after deploy before Turso ALTER is applied
  if (
    msg.includes("controlWardsBought") ||
    msg.includes("visionScore") ||
    msg.includes("does not exist")
  ) {
    return (
      "Database is missing SoloQ vision columns. Apply prisma/turso-soloq-advanced.sql " +
      "on Turso (visionScore + controlWardsBought), then retry."
    );
  }
  if (msg.includes("RIOT_API_KEY") || msg.includes("Unknown apikey")) {
    return "Riot API key is missing or invalid. Update RIOT_API_KEY and restart/redeploy.";
  }
  // Keep message short for the UI; still log full error server-side.
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

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
      { error: publicErrorMessage(error, "Failed to load SoloQ advanced stats") },
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
      { error: publicErrorMessage(error, "Failed to sync SoloQ advanced stats") },
      { status: 500 },
    );
  }
}
