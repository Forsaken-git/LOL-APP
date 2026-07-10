import { NextResponse } from "next/server";
import { buildLcuRosterPayload } from "@/lib/players/lcu-roster";

export const dynamic = "force-dynamic";

/** Roster for the local LCU collector — mirrors active players from the hub DB. */
export async function GET() {
  const payload = await buildLcuRosterPayload();
  return NextResponse.json(payload);
}
