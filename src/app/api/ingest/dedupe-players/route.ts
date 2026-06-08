import { NextResponse } from "next/server";
import { verifyIngestAuth } from "@/lib/ingest/auth";
import { dedupeActivePlayers } from "@/lib/player-dedupe";

export async function POST(request: Request) {
  const authError = verifyIngestAuth(request);
  if (authError) return authError;

  const result = await dedupeActivePlayers();
  return NextResponse.json({ success: true, ...result });
}
