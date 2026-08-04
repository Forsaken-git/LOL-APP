import { NextResponse } from "next/server";
import {
  LOL_REGIONS,
  type PlayerRegion,
} from "@/lib/player-accounts-shared";
import { parseScoutingInput } from "@/lib/scouting/parse-input";
import { scoutTeam } from "@/lib/scouting/scout-team";

export const dynamic = "force-dynamic";

type Body = {
  input?: string;
  region?: PlayerRegion;
  riotIds?: string[];
};

function isPlayerRegion(value: unknown): value is PlayerRegion {
  return typeof value === "string" && (LOL_REGIONS as string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const fallbackRegion = isPlayerRegion(body.region) ? body.region : "WEST";

    let region: PlayerRegion;
    let riotIds: string[];
    let warnings: string[];

    if (Array.isArray(body.riotIds) && body.riotIds.length > 0) {
      const parsed = parseScoutingInput(
        body.riotIds.join("\n"),
        fallbackRegion,
      );
      region = isPlayerRegion(body.region) ? body.region : parsed.region;
      riotIds = parsed.riotIds;
      warnings = parsed.warnings;
    } else if (typeof body.input === "string") {
      const parsed = parseScoutingInput(body.input, fallbackRegion);
      // URL region wins when present; otherwise use the UI region toggle.
      region =
        parsed.regionSource === "url" ? parsed.region : fallbackRegion;
      riotIds = parsed.riotIds;
      warnings = parsed.warnings;
    } else {
      return NextResponse.json(
        { error: "Provide input (OP.GG URL / Riot IDs) or riotIds[]" },
        { status: 400 },
      );
    }

    if (riotIds.length === 0) {
      return NextResponse.json(
        {
          error: "No valid Riot IDs found",
          warnings,
        },
        { status: 400 },
      );
    }

    const report = await scoutTeam({ region, riotIds, warnings });
    return NextResponse.json(report);
  } catch (error) {
    console.error("[scouting]", error);
    return NextResponse.json(
      { error: "Failed to build scouting report" },
      { status: 500 },
    );
  }
}
