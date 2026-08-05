import { NextResponse } from "next/server";
import { verifyIngestAuth } from "@/lib/ingest/auth";
import { buildLcuRosterPayload } from "@/lib/players/lcu-roster";

export const dynamic = "force-dynamic";

/**
 * Roster for the local LCU collector — mirrors active players from the hub DB.
 * Auth: same as ingest (`x-api-key` / Bearer = INGEST_API_KEY).
 * Not a user-session login route.
 */
export async function GET(request: Request) {
  const authError = verifyIngestAuth(request);
  if (authError) return authError;

  const payload = await buildLcuRosterPayload();
  return NextResponse.json(payload);
}
