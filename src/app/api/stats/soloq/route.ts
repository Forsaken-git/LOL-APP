import { NextResponse } from "next/server";
import { loadSoloQRosterStats } from "@/lib/stats/soloq-roster";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await loadSoloQRosterStats({ bypassCache: true });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[stats/soloq]", error);
    return NextResponse.json(
      { error: "Failed to load SoloQ stats" },
      { status: 500 },
    );
  }
}
