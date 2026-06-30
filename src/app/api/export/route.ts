import { NextResponse } from "next/server";
import { verifyIngestAuth } from "@/lib/ingest/auth";
import { buildExportPayload } from "@/lib/ingest/export-db";

export async function GET(request: Request) {
  const authError = verifyIngestAuth(request);
  if (authError) return authError;

  const payload = await buildExportPayload();
  const [playerCount, matchCount, eventCount] = [
    payload.players?.length ?? 0,
    payload.matches?.length ?? 0,
    payload.events?.length ?? 0,
  ];

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    counts: { players: playerCount, matches: matchCount, events: eventCount },
    payload,
  });
}
