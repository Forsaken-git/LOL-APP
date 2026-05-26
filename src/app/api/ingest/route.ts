import { NextResponse } from "next/server";
import { verifyIngestAuth } from "@/lib/ingest/auth";
import { runIngest } from "@/lib/ingest/sync";
import type { IngestPayload } from "@/lib/ingest/types";

export async function POST(request: Request) {
  const authError = verifyIngestAuth(request);
  if (authError) return authError;

  let payload: IngestPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !payload.players?.length &&
    !payload.matches?.length &&
    !payload.events?.length
  ) {
    return NextResponse.json(
      {
        error:
          "Payload must include at least one of: players, matches, events",
      },
      { status: 400 },
    );
  }

  const result = await runIngest(payload);
  return NextResponse.json(result, { status: result.success ? 200 : 207 });
}

export async function GET(request: Request) {
  const authError = verifyIngestAuth(request);
  if (authError) return authError;

  const { prisma } = await import("@/lib/prisma");
  const lastRun = await prisma.ingestRun.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const [playerCount, matchCount, eventCount] = await Promise.all([
    prisma.player.count({ where: { active: true } }),
    prisma.match.count(),
    prisma.event.count(),
  ]);

  return NextResponse.json({
    counts: { players: playerCount, matches: matchCount, events: eventCount },
    lastIngest: lastRun
      ? {
          at: lastRun.createdAt,
          source: lastRun.source,
          success: lastRun.success,
          summary: JSON.parse(lastRun.summary),
        }
      : null,
  });
}
